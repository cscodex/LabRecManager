const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3333;

// Config file path
const CONFIG_FILE = path.join(__dirname, 'projects.json');

// Default projects config
const defaultProjects = [
    {
        id: 'labrecmanager',
        name: 'Lab Record Manager',
        rootDir: path.join(__dirname, '..'),
        server: { dir: 'server', port: 5000, command: 'npm run dev' },
        client: { dir: 'client', port: 3000, command: 'npm run dev' },
        active: true
    }
];

// Load projects from config
const loadProjects = () => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading projects config:', err);
    }
    return defaultProjects;
};

// Save projects to config
const saveProjects = (projects) => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(projects, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving projects config:', err);
        return false;
    }
};

// Initialize projects
let projects = loadProjects();
saveProjects(projects); // Ensure config file exists

// Store logs per project
const projectLogs = {};

// Initialize logs for each project
projects.forEach(p => {
    projectLogs[p.id] = { server: [], client: [] };
});

const MAX_LOGS = 100;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to run commands
const runCommand = (cmd, cwd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject({ error: error.message, stderr, stdout });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

// Add log entry
const addLog = (projectId, type, message) => {
    if (!projectLogs[projectId]) {
        projectLogs[projectId] = { server: [], client: [] };
    }
    const logs = projectLogs[projectId][type];
    logs.push({ time: new Date().toISOString(), message });
    if (logs.length > MAX_LOGS) logs.shift();
};

// Kill process on port
const killPort = async (port) => {
    try {
        await runCommand(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, __dirname);
        return true;
    } catch {
        return false;
    }
};

// Check if port is in use
const isPortInUse = async (port) => {
    try {
        await runCommand(`lsof -ti:${port}`, __dirname);
        return true;
    } catch {
        return false;
    }
};

// Get all projects
app.get('/api/projects', (req, res) => {
    res.json(projects);
});

// Add new project
app.post('/api/projects', (req, res) => {
    const { name, rootDir, server, client } = req.body;

    if (!name || !rootDir) {
        return res.status(400).json({ success: false, error: 'Name and rootDir are required' });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    if (projects.find(p => p.id === id)) {
        return res.status(400).json({ success: false, error: 'Project with this name already exists' });
    }

    const newProject = {
        id,
        name,
        rootDir,
        server: server || { dir: 'server', port: 5000, command: 'npm run dev' },
        client: client || { dir: 'client', port: 3000, command: 'npm run dev' },
        active: true
    };

    projects.push(newProject);
    projectLogs[id] = { server: [], client: [] };
    saveProjects(projects);

    res.json({ success: true, project: newProject });
});

// Update project
app.put('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const projectIndex = projects.findIndex(p => p.id === id);

    if (projectIndex === -1) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    projects[projectIndex] = { ...projects[projectIndex], ...req.body, id };
    saveProjects(projects);

    res.json({ success: true, project: projects[projectIndex] });
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const projectIndex = projects.findIndex(p => p.id === id);

    if (projectIndex === -1) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    projects.splice(projectIndex, 1);
    delete projectLogs[id];
    saveProjects(projects);

    res.json({ success: true });
});

// Get status for a project
app.get('/api/projects/:id/status', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const serverRunning = await isPortInUse(project.server.port);
    const clientRunning = await isPortInUse(project.client.port);

    res.json({
        server: serverRunning ? 'running' : 'stopped',
        client: clientRunning ? 'running' : 'stopped',
        serverLogs: (projectLogs[id]?.server || []).slice(-20),
        clientLogs: (projectLogs[id]?.client || []).slice(-20)
    });
});

// Restart Server for a project
app.post('/api/projects/:id/restart-server', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        const serverDir = path.join(project.rootDir, project.server.dir);

        addLog(id, 'server', `⚡ Stopping server on port ${project.server.port}...`);
        await killPort(project.server.port);

        addLog(id, 'server', `🚀 Starting server: ${project.server.command}`);

        const [cmd, ...args] = project.server.command.split(' ');
        const serverProcess = spawn(cmd, args, {
            cwd: serverDir,
            detached: true,
            stdio: 'pipe',
            shell: true
        });

        serverProcess.stdout.on('data', (data) => {
            addLog(id, 'server', data.toString().trim());
        });

        serverProcess.stderr.on('data', (data) => {
            addLog(id, 'server', `[ERR] ${data.toString().trim()}`);
        });

        serverProcess.on('error', (err) => {
            addLog(id, 'server', `[ERROR] ${err.message}`);
        });

        res.json({ success: true, message: 'Server restarting...' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restart Client for a project
app.post('/api/projects/:id/restart-client', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        const clientDir = path.join(project.rootDir, project.client.dir);

        addLog(id, 'client', `⚡ Stopping client on port ${project.client.port}...`);
        await killPort(project.client.port);

        addLog(id, 'client', `🚀 Starting client: ${project.client.command}`);

        const [cmd, ...args] = project.client.command.split(' ');
        const clientProcess = spawn(cmd, args, {
            cwd: clientDir,
            detached: true,
            stdio: 'pipe',
            shell: true
        });

        clientProcess.stdout.on('data', (data) => {
            addLog(id, 'client', data.toString().trim());
        });

        clientProcess.stderr.on('data', (data) => {
            addLog(id, 'client', `[ERR] ${data.toString().trim()}`);
        });

        clientProcess.on('error', (err) => {
            addLog(id, 'client', `[ERROR] ${err.message}`);
        });

        res.json({ success: true, message: 'Client restarting...' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stop Server for a project
app.post('/api/projects/:id/stop-server', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        await killPort(project.server.port);
        addLog(id, 'server', '🛑 Server stopped');
        res.json({ success: true, message: 'Server stopped' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stop Client for a project
app.post('/api/projects/:id/stop-client', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        await killPort(project.client.port);
        addLog(id, 'client', '🛑 Client stopped');
        res.json({ success: true, message: 'Client stopped' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Git Push for a project
app.post('/api/projects/:id/push', async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        const commitMsg = message || `Update - ${new Date().toLocaleString()}`;

        // Get git remotes to show which repos we're pushing to
        let remoteNames = [];
        let remotesInfo = '';
        try {
            const remotesResult = await runCommand('git remote -v', project.rootDir);
            const pushRemotes = remotesResult.stdout.split('\n')
                .filter(line => line.includes('(push)'))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return { name: parts[0], url: parts[1] };
                });
            remoteNames = [...new Set(pushRemotes.map(r => r.name))];
            remotesInfo = pushRemotes.map(r => `${r.name}: ${r.url}`).join(', ') || 'default';
            addLog(id, 'server', `📡 Found ${remoteNames.length} remote(s): ${remoteNames.join(', ')}`);
            addLog(id, 'client', `📡 Found ${remoteNames.length} remote(s): ${remoteNames.join(', ')}`);
        } catch (e) {
            remoteNames = ['origin'];
            remotesInfo = 'origin (default)';
        }

        addLog(id, 'server', `📦 Git: Adding all changes...`);
        addLog(id, 'client', `📦 Git: Adding all changes...`);
        await runCommand('git add .', project.rootDir);

        addLog(id, 'server', `📝 Git: Committing - "${commitMsg}"`);
        addLog(id, 'client', `📝 Git: Committing - "${commitMsg}"`);
        let hasNewCommit = true;
        try {
            const commitResult = await runCommand(`git commit -m "${commitMsg}"`, project.rootDir);
            // Get the new commit hash
            const hashResult = await runCommand('git rev-parse --short HEAD', project.rootDir);
            const newHash = hashResult.stdout.trim();
            addLog(id, 'server', `✓ Committed: ${newHash}`);
            addLog(id, 'client', `✓ Committed: ${newHash}`);
        } catch (e) {
            if (e.stdout && e.stdout.includes('nothing to commit')) {
                hasNewCommit = false;
                addLog(id, 'server', '✓ Nothing new to commit, will push any unpushed commits...');
                addLog(id, 'client', '✓ Nothing new to commit, will push any unpushed commits...');
            }
        }

        // Push to ALL remotes
        const pushResults = [];
        for (const remoteName of remoteNames) {
            addLog(id, 'server', `🚀 Pushing to ${remoteName}...`);
            addLog(id, 'client', `🚀 Pushing to ${remoteName}...`);
            try {
                const pushResult = await runCommand(`git push ${remoteName}`, project.rootDir);
                const output = pushResult.stdout + pushResult.stderr;
                if (output.includes('Everything up-to-date')) {
                    addLog(id, 'server', `✓ ${remoteName}: Already up-to-date`);
                    addLog(id, 'client', `✓ ${remoteName}: Already up-to-date`);
                    pushResults.push({ remote: remoteName, status: 'up-to-date' });
                } else {
                    addLog(id, 'server', `✅ ${remoteName}: Push successful!`);
                    addLog(id, 'client', `✅ ${remoteName}: Push successful!`);
                    pushResults.push({ remote: remoteName, status: 'pushed' });
                }
            } catch (pushErr) {
                const errOutput = pushErr.stderr || pushErr.stdout || pushErr.error || '';
                if (errOutput.includes('Everything up-to-date')) {
                    addLog(id, 'server', `✓ ${remoteName}: Already up-to-date`);
                    addLog(id, 'client', `✓ ${remoteName}: Already up-to-date`);
                    pushResults.push({ remote: remoteName, status: 'up-to-date' });
                } else {
                    addLog(id, 'server', `❌ ${remoteName}: ${pushErr.error || errOutput}`);
                    addLog(id, 'client', `❌ ${remoteName}: ${pushErr.error || errOutput}`);
                    pushResults.push({ remote: remoteName, status: 'failed', error: pushErr.error || errOutput });
                }
            }
        }

        const successCount = pushResults.filter(r => r.status !== 'failed').length;
        const failedCount = pushResults.filter(r => r.status === 'failed').length;

        let resultMessage = hasNewCommit
            ? `Committed and pushed to ${successCount}/${remoteNames.length} remote(s)`
            : `No new commits. Pushed to ${successCount}/${remoteNames.length} remote(s)`;

        if (failedCount > 0) {
            resultMessage += ` (${failedCount} failed)`;
        }

        addLog(id, 'server', `📊 ${resultMessage}`);
        addLog(id, 'client', `📊 ${resultMessage}`);

        res.json({
            success: failedCount === 0,
            message: resultMessage,
            remotes: remotesInfo,
            pushResults
        });
    } catch (error) {
        const errMsg = `❌ Push failed: ${error.error || error.message}`;
        addLog(id, 'server', errMsg);
        addLog(id, 'client', errMsg);
        res.status(500).json({ success: false, error: error.error || error.message });
    }
});

// Git Remotes for a project
app.get('/api/projects/:id/git-remotes', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        const result = await runCommand('git remote -v', project.rootDir);
        const remotes = result.stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split(/\s+/);
                return {
                    name: parts[0],
                    url: parts[1],
                    type: parts[2]?.replace(/[()]/g, '') || 'unknown'
                };
            });
        res.json({ success: true, remotes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Git Status for a project
app.get('/api/projects/:id/git-status', async (req, res) => {
    const { id } = req.params;
    const project = projects.find(p => p.id === id);

    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        const result = await runCommand('git status --short', project.rootDir);
        res.json({ success: true, status: result.stdout });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all statuses (for dashboard overview)
app.get('/api/all-status', async (req, res) => {
    const statuses = {};

    for (const project of projects) {
        const serverRunning = await isPortInUse(project.server.port);
        const clientRunning = await isPortInUse(project.client.port);
        statuses[project.id] = {
            server: serverRunning ? 'running' : 'stopped',
            client: clientRunning ? 'running' : 'stopped'
        };
    }

    res.json(statuses);
});

app.listen(PORT, () => {
    console.log(`\n🎛️  Multi-Project Dev Control Panel running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n📁 Managing ${projects.length} project(s):`);
    projects.forEach(p => {
        console.log(`   • ${p.name} (Server: ${p.server.port}, Client: ${p.client.port})`);
    });
    console.log(`\n📋 Available actions:`);
    console.log(`   • Add/Remove/Edit projects`);
    console.log(`   • Restart/Stop Server/Client per project`);
    console.log(`   • Push changes to Git repos\n`);
});
