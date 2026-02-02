// Among Us - Real Life Photo Task Game
class AmongUsGame {
    constructor(gameData, container) {
        this.gameData = gameData;
        this.container = container;
        this.db = null;
        this.gameRef = null;
        this.playerId = null;
        this.playerName = null;
        this.gameCode = null;
        this.isHost = false;
        this.meetingSound = null;
        
        this.initFirebase();
        this.createMeetingSound();
    }

    createMeetingSound() {
        // Create a simple beep sound using Web Audio API
        this.meetingSound = () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        };
    }

    initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyDemoKey123456789",
            authDomain: "youth-group-games.firebaseapp.com",
            databaseURL: "https://youth-group-games-default-rtdb.firebaseio.com",
            projectId: "youth-group-games",
            storageBucket: "youth-group-games.appspot.com",
            messagingSenderId: "123456789",
            appId: "1:123456789:web:abc123def456"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.database();
        
        this.showLobbyScreen();
    }

    showLobbyScreen() {
        this.container.innerHTML = `
            <div class="amongus-lobby">
                <h3>Among Us - Real Life Edition</h3>
                <p>${this.gameData.description || 'Play Among Us in real life with photo tasks!'}</p>
                
                <div class="lobby-options">
                    <button id="create-game-btn" class="btn btn-primary">Create New Game</button>
                    <div class="divider">OR</div>
                    <div class="join-game-section">
                        <input type="text" id="game-code-input" placeholder="Enter Game Code" maxlength="6">
                        <input type="text" id="player-name-input" placeholder="Your Name" maxlength="20">
                        <button id="join-game-btn" class="btn btn-secondary">Join Game</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('create-game-btn').addEventListener('click', () => this.createGame());
        document.getElementById('join-game-btn').addEventListener('click', () => this.joinGame());
    }

    generateGameCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async createGame() {
        this.gameCode = this.generateGameCode();
        this.playerId = 'player_' + Date.now();
        this.playerName = prompt('Enter your name:') || 'Host';
        this.isHost = true;

        const gameState = {
            code: this.gameCode,
            host: this.playerId,
            status: 'lobby',
            settings: {
                numImpostors: 1,
                tasksPerPlayer: 6,
                totalTasks: 15,
                emergencyCooldown: 30,
                reportCooldown: 10,
                discussionTime: 60,
                votingTime: 15
            },
            players: {
                [this.playerId]: {
                    name: this.playerName,
                    role: null,
                    alive: true,
                    isGhost: false,
                    tasks: [],
                    tasksCompleted: 0,
                    votedFor: null,
                    lastEmergency: 0,
                    lastReport: 0
                }
            },
            meeting: {
                active: false,
                type: null,
                caller: null,
                phase: null,
                startTime: null
            },
            taskPhotos: {},
            hiddenDeaths: [],
            votes: {},
            winner: null
        };

        this.gameRef = this.db.ref('games/' + this.gameCode);
        await this.gameRef.set(gameState);
        
        this.listenToGameUpdates();
        this.showWaitingRoom();
    }

    async joinGame() {
        const code = document.getElementById('game-code-input').value.toUpperCase().trim();
        const name = document.getElementById('player-name-input').value.trim();

        if (!code || !name) {
            alert('Please enter both game code and your name!');
            return;
        }

        this.gameCode = code;
        this.playerName = name;
        this.playerId = 'player_' + Date.now();
        this.gameRef = this.db.ref('games/' + this.gameCode);

        const snapshot = await this.gameRef.once('value');
        if (!snapshot.exists()) {
            alert('Game not found! Check the code and try again.');
            return;
        }

        const gameState = snapshot.val();
        if (gameState.status !== 'lobby') {
            alert('Game has already started!');
            return;
        }

        await this.gameRef.child('players/' + this.playerId).set({
            name: this.playerName,
            role: null,
            alive: true,
            isGhost: false,
            tasks: [],
            tasksCompleted: 0,
            votedFor: null,
            lastEmergency: 0,
            lastReport: 0
        });

        this.listenToGameUpdates();
        this.showWaitingRoom();
    }

    listenToGameUpdates() {
        this.gameRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (!gameState) return;

            // Check for meeting alerts
            if (gameState.meeting && gameState.meeting.active && gameState.meeting.startTime) {
                const meetingStart = gameState.meeting.startTime;
                const now = Date.now();
                if (now - meetingStart < 2000) { // Within 2 seconds of meeting start
                    this.meetingSound();
                }
            }

            if (gameState.status === 'lobby') {
                this.updateWaitingRoom(gameState);
            } else if (gameState.status === 'playing') {
                if (gameState.meeting && gameState.meeting.active) {
                    this.showMeetingScreen(gameState);
                } else {
                    if (this.isHost) {
                        this.showHostDashboard(gameState);
                    } else {
                        this.updateGameScreen(gameState);
                    }
                }
            } else if (gameState.status === 'ended') {
                this.showGameOver(gameState);
            }
        });
    }

    showWaitingRoom() {
        this.container.innerHTML = `
            <div class="amongus-waiting">
                <h3>Waiting Room</h3>
                <div class="game-code-display">
                    <p>Game Code:</p>
                    <h2>${this.gameCode}</h2>
                    <p class="code-hint">Share this code with your friends!</p>
                </div>
                
                <div id="players-waiting-list"></div>
                
                ${this.isHost ? `
                    <div class="host-controls">
                        <h4>Game Settings</h4>
                        <div class="setting-group">
                            <label>Number of Impostors:</label>
                            <select id="num-impostors">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>
                        </div>
                        <button id="start-game-btn" class="btn btn-primary">Start Game</button>
                    </div>
                ` : '<p class="waiting-message">Waiting for host to start the game...</p>'}
            </div>
        `;

        if (this.isHost) {
            document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
            document.getElementById('num-impostors').addEventListener('change', (e) => {
                this.gameRef.child('settings/numImpostors').set(parseInt(e.target.value));
            });
        }
    }

    updateWaitingRoom(gameState) {
        const playersList = document.getElementById('players-waiting-list');
        if (!playersList) return;

        const players = Object.entries(gameState.players || {});
        playersList.innerHTML = `
            <h4>Players (${players.length})</h4>
            <div class="players-grid">
                ${players.map(([id, player]) => `
                    <div class="player-card-waiting">
                        <span class="player-icon">👤</span>
                        <span class="player-name">${player.name}</span>
                        ${id === gameState.host ? '<span class="host-badge">HOST</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    async startGame() {
        const snapshot = await this.gameRef.once('value');
        const gameState = snapshot.val();
        const players = Object.keys(gameState.players);

        if (players.length < 4) {
            alert('You need at least 4 players to start!');
            return;
        }

        // Assign roles
        const numImpostors = Math.min(gameState.settings.numImpostors, Math.floor(players.length / 3));
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const impostors = shuffled.slice(0, numImpostors);

        // Assign 6 random task numbers (1-15) to each crewmate
        const updates = {};
        players.forEach(playerId => {
            const isImpostor = impostors.includes(playerId);
            updates[`players/${playerId}/role`] = isImpostor ? 'impostor' : 'crewmate';
            
            // Give everyone tasks (impostors get fake tasks)
            const taskNumbers = [];
            const availableTasks = Array.from({length: 15}, (_, i) => i + 1);
            for (let i = 0; i < 6; i++) {
                const randomIndex = Math.floor(Math.random() * availableTasks.length);
                taskNumbers.push(availableTasks.splice(randomIndex, 1)[0]);
            }
            updates[`players/${playerId}/tasks`] = taskNumbers.map(num => ({
                number: num,
                completed: false,
                photoUrl: null
            }));
        });

        updates['status'] = 'playing';
        
        await this.gameRef.update(updates);
    }

    updateGameScreen(gameState) {
        const player = gameState.players[this.playerId];
        const isImpostor = player.role === 'impostor';
        const isAlive = player.alive;
        const isGhost = player.isGhost;

        // Calculate stats
        const alivePlayers = Object.values(gameState.players).filter(p => p.alive && !p.isGhost);
        const totalTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
        const completedTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasksCompleted || 0), 0);
        const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
        
        const revealedDeaths = gameState.hiddenDeaths ? gameState.hiddenDeaths.length : 0;

        this.container.innerHTML = `
            <div class="amongus-game ${isGhost ? 'ghost-mode' : ''}">
                <div class="game-header">
                    <h3>${this.gameData.name}</h3>
                    <div class="role-display ${isImpostor ? 'impostor' : 'crewmate'}">
                        ${isImpostor ? '🔪 IMPOSTOR' : '👷 CREWMATE'}
                        ${isGhost ? ' 👻 (GHOST)' : ''}
                    </div>
                </div>

                <div class="game-stats">
                    <div class="stat">
                        <strong>Alive Players:</strong> ${alivePlayers.length}
                    </div>
                    <div class="stat">
                        <strong>Dead Players:</strong> ${revealedDeaths}
                    </div>
                    <div class="stat">
                        <strong>Task Progress:</strong> ${taskProgress}%
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${taskProgress}%"></div>
                        </div>
                    </div>
                </div>

                ${isGhost ? `
                    <div class="ghost-message">
                        <h4>👻 You are a ghost</h4>
                        <p>You can continue doing tasks, but you cannot call meetings or vote.</p>
                    </div>
                ` : ''}

                <div class="action-buttons">
                    ${!isGhost ? `
                        <button id="emergency-btn" class="btn btn-primary">🚨 Emergency Meeting</button>
                        <button id="report-btn" class="btn btn-danger">☠️ Report Body</button>
                        <button id="dead-btn" class="btn btn-secondary">💀 I'm Dead</button>
                    ` : ''}
                </div>

                <div id="tasks-section">
                    <h4>Your Tasks:</h4>
                    <div id="tasks-list" class="tasks-container"></div>
                </div>
            </div>
        `;

        this.renderTasks(player, isImpostor);

        if (!isGhost) {
            document.getElementById('emergency-btn')?.addEventListener('click', () => this.callEmergencyMeeting(gameState));
            document.getElementById('report-btn')?.addEventListener('click', () => this.reportBody(gameState));
            document.getElementById('dead-btn')?.addEventListener('click', () => this.markAsDead());
        }
    }

    renderTasks(player, isImpostor) {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;

        tasksList.innerHTML = (player.tasks || []).map((task, index) => `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <div class="task-info">
                    <strong>Task #${task.number}</strong>
                    ${task.completed ? '<span class="task-status">✅ Approved</span>' : 
                      task.photoUrl ? '<span class="task-status">⏳ Pending</span>' : ''}
                </div>
                ${!task.completed && !task.photoUrl ? `
                    <label class="photo-upload-btn">
                        📸 Take Photo
                        <input type="file" accept="image/*" capture="environment" 
                            data-task-index="${index}" class="task-photo-input" style="display: none;">
                    </label>
                ` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.task-photo-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.taskIndex);
                this.uploadTaskPhoto(e.target.files[0], index, isImpostor);
            });
        });
    }

    async uploadTaskPhoto(file, taskIndex, isImpostor) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const photoData = e.target.result;
            
            if (isImpostor) {
                // Fake upload for impostor - doesn't actually send to host
                alert('Photo taken! (This is a fake task - the photo was not sent to the host)');
                return;
            }

            // Real upload for crewmate
            const photoId = `photo_${this.playerId}_${taskIndex}_${Date.now()}`;
            const player = (await this.gameRef.child(`players/${this.playerId}`).once('value')).val();
            
            await this.gameRef.child(`taskPhotos/${photoId}`).set({
                playerId: this.playerId,
                playerName: player.name,
                taskIndex: taskIndex,
                taskNumber: player.tasks[taskIndex].number,
                photoData: photoData,
                timestamp: Date.now(),
                approved: null
            });

            await this.gameRef.child(`players/${this.playerId}/tasks/${taskIndex}/photoUrl`).set(photoId);
            
            alert('Photo submitted! Waiting for host approval...');
        };
        reader.readAsDataURL(file);
    }

    async markAsDead() {
        if (!confirm('Are you sure you were killed? This cannot be undone.')) return;

        const updates = {};
        updates[`players/${this.playerId}/isGhost`] = true;
        updates[`hiddenDeaths/${this.playerId}`] = {
            name: this.playerName,
            timestamp: Date.now()
        };

        await this.gameRef.update(updates);
        alert('You are now a ghost. Your death will be revealed at the next meeting.');
    }

    async callEmergencyMeeting(gameState) {
        const now = Date.now();
        const player = gameState.players[this.playerId];
        const cooldown = gameState.settings.emergencyCooldown * 1000;

        if (player.lastEmergency && now - player.lastEmergency < cooldown) {
            const remaining = Math.ceil((cooldown - (now - player.lastEmergency)) / 1000);
            alert(`Emergency meeting on cooldown! Wait ${remaining} more seconds.`);
            return;
        }

        await this.gameRef.update({
            'meeting/active': true,
            'meeting/type': 'emergency',
            'meeting/caller': this.playerId,
            'meeting/phase': 'waiting',
            'meeting/startTime': Date.now(),
            [`players/${this.playerId}/lastEmergency`]: now
        });
    }

    async reportBody(gameState) {
        const now = Date.now();
        const player = gameState.players[this.playerId];
        const cooldown = gameState.settings.reportCooldown * 1000;

        if (player.lastReport && now - player.lastReport < cooldown) {
            const remaining = Math.ceil((cooldown - (now - player.lastReport)) / 1000);
            alert(`Report on cooldown! Wait ${remaining} more seconds.`);
            return;
        }

        await this.gameRef.update({
            'meeting/active': true,
            'meeting/type': 'report',
            'meeting/caller': this.playerId,
            'meeting/phase': 'waiting',
            'meeting/startTime': Date.now(),
            [`players/${this.playerId}/lastReport`]: now
        });
    }

    showHostDashboard(gameState) {
        const pendingPhotos = Object.entries(gameState.taskPhotos || {})
            .filter(([_, photo]) => photo.approved === null);
        
        const alivePlayers = Object.values(gameState.players).filter(p => p.alive && !p.isGhost);
        const revealedDeaths = gameState.hiddenDeaths ? Object.keys(gameState.hiddenDeaths).length : 0;
        
        const totalTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
        const completedTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasksCompleted || 0), 0);

        this.container.innerHTML = `
            <div class="host-dashboard">
                <h3>🎮 Host Dashboard</h3>
                
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h4>Alive Players</h4>
                        <p class="stat-number">${alivePlayers.length}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Dead Players</h4>
                        <p class="stat-number">${revealedDeaths}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Tasks Done</h4>
                        <p class="stat-number">${completedTasks}/${totalTasks}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Pending Photos</h4>
                        <p class="stat-number">${pendingPhotos.length}</p>
                    </div>
                </div>

                <div class="photo-approvals">
                    <h4>📸 Photo Submissions (${pendingPhotos.length})</h4>
                    <div id="pending-photos-list"></div>
                </div>

                <div class="player-roles">
                    <h4>👥 Player Roles</h4>
                    <div id="roles-list"></div>
                </div>
            </div>
        `;

        this.renderPendingPhotos(pendingPhotos);
        this.renderPlayerRoles(gameState.players);
    }

    renderPendingPhotos(pendingPhotos) {
        const list = document.getElementById('pending-photos-list');
        if (!list) return;

        if (pendingPhotos.length === 0) {
            list.innerHTML = '<p class="empty-message">No pending photo submissions</p>';
            return;
        }

        list.innerHTML = pendingPhotos.map(([photoId, photo]) => `
            <div class="photo-submission">
                <div class="photo-info">
                    <strong>${photo.playerName}</strong> - Task #${photo.taskNumber}
                </div>
                <img src="${photo.photoData}" alt="Task photo" class="task-photo">
                <div class="photo-actions">
                    <button class="btn btn-primary approve-photo" data-photo-id="${photoId}">✅ Approve</button>
                    <button class="btn btn-secondary reject-photo" data-photo-id="${photoId}">❌ Reject</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.approve-photo').forEach(btn => {
            btn.addEventListener('click', () => this.approvePhoto(btn.dataset.photoId));
        });

        document.querySelectorAll('.reject-photo').forEach(btn => {
            btn.addEventListener('click', () => this.rejectPhoto(btn.dataset.photoId));
        });
    }

    async approvePhoto(photoId) {
        const photoSnapshot = await this.gameRef.child(`taskPhotos/${photoId}`).once('value');
        const photo = photoSnapshot.val();

        if (!photo) return;

        await this.gameRef.child(`taskPhotos/${photoId}/approved`).set(true);
        await this.gameRef.child(`players/${photo.playerId}/tasks/${photo.taskIndex}/completed`).set(true);
        
        // Increment completed tasks count
        const playerSnapshot = await this.gameRef.child(`players/${photo.playerId}`).once('value');
        const player = playerSnapshot.val();
        const completedCount = player.tasks.filter(t => t.completed).length;
        await this.gameRef.child(`players/${photo.playerId}/tasksCompleted`).set(completedCount);
    }

    async rejectPhoto(photoId) {
        const photoSnapshot = await this.gameRef.child(`taskPhotos/${photoId}`).once('value');
        const photo = photoSnapshot.val();

        if (!photo) return;

        await this.gameRef.child(`taskPhotos/${photoId}/approved`).set(false);
        await this.gameRef.child(`players/${photo.playerId}/tasks/${photo.taskIndex}/photoUrl`).set(null);
        
        alert(`Photo rejected. Player can resubmit.`);
    }

    renderPlayerRoles(players) {
        const list = document.getElementById('roles-list');
        if (!list) return;

        list.innerHTML = Object.entries(players).map(([id, player]) => `
            <div class="player-role ${player.role}">
                <span class="player-name">${player.name}</span>
                <span class="role-badge ${player.role}">${player.role === 'impostor' ? '🔪 IMPOSTOR' : '👷 CREWMATE'}</span>
                ${player.isGhost ? '<span class="ghost-badge">👻</span>' : ''}
            </div>
        `).join('');
    }

    showMeetingScreen(gameState) {
        const meeting = gameState.meeting;
        const player = gameState.players[this.playerId];
        const caller = gameState.players[meeting.caller];
        
        // Reveal all hidden deaths
        const hiddenDeaths = gameState.hiddenDeaths || {};
        const deadCount = Object.keys(hiddenDeaths).length;
        const alivePlayers = Object.entries(gameState.players).filter(([id, p]) => 
            p.alive && !p.isGhost && !hiddenDeaths[id]
        );

        const meetingText = meeting.type === 'emergency' ? 'EMERGENCY MEETING' : 'BODY REPORTED';
        const meetingClass = meeting.type === 'emergency' ? 'emergency' : 'body-report';

        this.container.innerHTML = `
            <div class="meeting-screen ${meetingClass}">
                <div class="meeting-banner">
                    <h2>${meetingText}</h2>
                </div>
                
                ${player.isGhost || hiddenDeaths[this.playerId] ? `
                    <div class="skull-display">
                        <h1>💀</h1>
                        <p>You are dead</p>
                    </div>
                ` : ''}

                <p class="meeting-caller">Called by: ${caller?.name || 'Unknown'}</p>
                
                <div class="death-reveal">
                    <h4>Deaths Revealed: ${deadCount}</h4>
                    ${deadCount > 0 ? `
                        <div class="dead-players-list">
                            ${Object.values(hiddenDeaths).map(death => `
                                <div class="dead-player">💀 ${death.name}</div>
                            `).join('')}
                        </div>
                    ` : '<p>No deaths</p>'}
                </div>

                ${this.isHost && meeting.phase === 'waiting' ? `
                    <div class="host-meeting-control">
                        <button id="start-discussion-btn" class="btn btn-primary">Start Discussion Timer</button>
                    </div>
                ` : ''}

                ${meeting.phase === 'discussion' ? `
                    <div class="discussion-phase">
                        <h4>💬 Discussion Time</h4>
                        <div id="timer-display" class="timer-display"></div>
                    </div>
                ` : ''}

                ${meeting.phase === 'voting' && !player.isGhost && !hiddenDeaths[this.playerId] ? `
                    <div class="voting-section">
                        <h4>⚖️ Vote to Eliminate:</h4>
                        ${!player.votedFor ? `
                            <div class="vote-buttons">
                                ${alivePlayers.map(([id, p]) => `
                                    <button class="vote-btn" data-player-id="${id}">
                                        ${p.name}
                                    </button>
                                `).join('')}
                                <button class="vote-btn" data-player-id="skip">Skip Vote</button>
                            </div>
                        ` : '<p class="voted-message">✅ You have voted</p>'}
                    </div>
                ` : meeting.phase === 'voting' ? `
                    <p class="ghost-vote-message">Ghosts cannot vote</p>
                ` : ''}

                <div id="vote-status"></div>
            </div>
        `;

        if (this.isHost && meeting.phase === 'waiting') {
            document.getElementById('start-discussion-btn')?.addEventListener('click', () => this.startDiscussion(gameState));
        }

        if (meeting.phase === 'discussion') {
            this.runDiscussionTimer(gameState);
        }

        if (meeting.phase === 'voting') {
            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.addEventListener('click', () => this.castVote(btn.dataset.playerId));
            });
            this.updateVoteStatus(gameState);
        }
    }

    async startDiscussion(gameState) {
        // Clear hidden deaths (reveal them)
        const hiddenDeaths = gameState.hiddenDeaths || {};
        const updates = {};
        
        Object.keys(hiddenDeaths).forEach(playerId => {
            updates[`players/${playerId}/alive`] = false;
        });
        updates['hiddenDeaths'] = {};
        updates['meeting/phase'] = 'discussion';
        updates['meeting/phaseStartTime'] = Date.now();

        await this.gameRef.update(updates);
    }

    runDiscussionTimer(gameState) {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        const discussionTime = gameState.settings.discussionTime * 1000;
        const startTime = gameState.meeting.phaseStartTime;
        
        const updateTimer = () => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((discussionTime - elapsed) / 1000));
            
            timerDisplay.textContent = `${remaining}s`;
            
            if (remaining === 0 && this.isHost) {
                this.startVoting();
            } else if (remaining > 0) {
                setTimeout(updateTimer, 100);
            }
        };
        
        updateTimer();
    }

    async startVoting() {
        await this.gameRef.update({
            'meeting/phase': 'voting',
            'meeting/phaseStartTime': Date.now(),
            'votes': {}
        });

        // Auto-end voting after voting time
        setTimeout(() => this.endVoting(), this.gameRef.once('value').then(s => s.val().settings.votingTime * 1000));
    }

    async castVote(playerId) {
        await this.gameRef.child(`players/${this.playerId}/votedFor`).set(playerId);
        await this.gameRef.child(`votes/${playerId}`).transaction(current => (current || 0) + 1);

        const snapshot = await this.gameRef.once('value');
        const gameState = snapshot.val();
        const hiddenDeaths = gameState.hiddenDeaths || {};
        const alivePlayers = Object.values(gameState.players).filter(p => p.alive && !p.isGhost && !hiddenDeaths[p.id]);
        const votedPlayers = Object.values(gameState.players).filter(p => p.votedFor && p.alive && !p.isGhost);

        if (votedPlayers.length >= alivePlayers.length && this.isHost) {
            this.endVoting();
        }
    }

    updateVoteStatus(gameState) {
        const statusDiv = document.getElementById('vote-status');
        if (!statusDiv) return;

        const hiddenDeaths = gameState.hiddenDeaths || {};
        const alivePlayers = Object.values(gameState.players).filter(p => p.alive && !p.isGhost && !hiddenDeaths[p.id]);
        const votedPlayers = Object.values(gameState.players).filter(p => p.votedFor);

        statusDiv.innerHTML = `
            <p class="vote-count">Votes: ${votedPlayers.length}/${alivePlayers.length}</p>
        `;
    }

    async endVoting() {
        const snapshot = await this.gameRef.once('value');
        const gameState = snapshot.val();
        const votes = gameState.votes || {};
        
        if (Object.keys(votes).length === 0) {
            alert('No votes cast. No one eliminated.');
        } else {
            const maxVotes = Math.max(...Object.values(votes));
            const eliminated = Object.entries(votes)
                .filter(([_, count]) => count === maxVotes)
                .map(([id, _]) => id);

            if (eliminated.length > 1 || eliminated[0] === 'skip') {
                alert('Tie or skip vote - no one eliminated.');
            } else {
                const playerName = gameState.players[eliminated[0]]?.name || 'Unknown';
                const playerRole = gameState.players[eliminated[0]]?.role || 'unknown';
                alert(`${playerName} was eliminated! They were a ${playerRole.toUpperCase()}.`);
                await this.gameRef.child(`players/${eliminated[0]}/alive`).set(false);
                await this.gameRef.child(`players/${eliminated[0]}/isGhost`).set(true);
            }
        }

        // Reset votes and end meeting
        const updates = {};
        Object.keys(gameState.players).forEach(id => {
            updates[`players/${id}/votedFor`] = null;
        });
        updates['votes'] = {};
        updates['meeting'] = {
            active: false,
            type: null,
            caller: null,
            phase: null,
            startTime: null
        };

        await this.gameRef.update(updates);

        // Check win conditions
        this.checkWinConditions();
    }

    async checkWinConditions() {
        const snapshot = await this.gameRef.once('value');
        const gameState = snapshot.val();

        const alivePlayers = Object.values(gameState.players).filter(p => p.alive && !p.isGhost);
        const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate').length;
        const aliveImpostors = alivePlayers.filter(p => p.role === 'impostor').length;

        // Impostors win if they equal or outnumber crewmates
        if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
            await this.gameRef.update({ status: 'ended', winner: 'impostors' });
            return;
        }

        // Crewmates win if all impostors eliminated
        if (aliveImpostors === 0) {
            await this.gameRef.update({ status: 'ended', winner: 'crewmates' });
            return;
        }

        // Crewmates win if 75% tasks completed
        const totalTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
        const completedTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasksCompleted || 0), 0);

        if (totalTasks > 0 && (completedTasks / totalTasks) >= 0.75) {
            await this.gameRef.update({ status: 'ended', winner: 'crewmates' });
            return;
        }
    }

    showGameOver(gameState) {
        const winner = gameState.winner;
        
        this.container.innerHTML = `
            <div class="game-over-screen">
                <h2>🎮 Game Over!</h2>
                <h3 class="${winner}-win">
                    ${winner === 'impostors' ? '🔪 Impostors Win!' : '👷 Crewmates Win!'}
                </h3>
                
                <div class="final-roles">
                    <h4>Roles Revealed:</h4>
                    ${Object.entries(gameState.players).map(([id, p]) => `
                        <div class="player-final ${p.role}">
                            ${p.name}: ${p.role === 'impostor' ? '🔪 IMPOSTOR' : '👷 CREWMATE'}
                        </div>
                    `).join('')}
                </div>

                ${this.isHost ? `
                    <button id="new-game-btn" class="btn btn-primary">New Game</button>
                ` : ''}
            </div>
        `;

        if (this.isHost) {
            document.getElementById('new-game-btn')?.addEventListener('click', () => {
                this.gameRef.remove();
                this.showLobbyScreen();
            });
        }
    }
}
