// Among Us Multiplayer Game
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
        
        this.initFirebase();
    }

    initFirebase() {
        // Firebase configuration (using a demo project - you should create your own)
        const firebaseConfig = {
            apiKey: "AIzaSyDemoKey123456789",
            authDomain: "youth-group-games.firebaseapp.com",
            databaseURL: "https://youth-group-games-default-rtdb.firebaseio.com",
            projectId: "youth-group-games",
            storageBucket: "youth-group-games.appspot.com",
            messagingSenderId: "123456789",
            appId: "1:123456789:web:abc123def456"
        };

        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.database();
        
        this.showLobbyScreen();
    }

    showLobbyScreen() {
        this.container.innerHTML = `
            <div class="amongus-lobby">
                <h3>Among Us - Multiplayer</h3>
                <p>${this.gameData.description || 'Play Among Us with your friends!'}</p>
                
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
            status: 'lobby', // lobby, playing, meeting, ended
            settings: {
                numImpostors: 1,
                numTasks: 5,
                discussionTime: 60,
                votingTime: 30,
                killCooldown: 20
            },
            players: {
                [this.playerId]: {
                    name: this.playerName,
                    role: null,
                    alive: true,
                    tasks: [],
                    tasksCompleted: 0,
                    votedFor: null,
                    x: 0,
                    y: 0
                }
            },
            sabotageActive: false,
            meetingCalled: false,
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

        // Check if game exists
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

        // Add player to game
        await this.gameRef.child('players/' + this.playerId).set({
            name: this.playerName,
            role: null,
            alive: true,
            tasks: [],
            tasksCompleted: 0,
            votedFor: null,
            x: 0,
            y: 0
        });

        this.listenToGameUpdates();
        this.showWaitingRoom();
    }

    listenToGameUpdates() {
        this.gameRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (!gameState) return;

            if (gameState.status === 'lobby') {
                this.updateWaitingRoom(gameState);
            } else if (gameState.status === 'playing') {
                this.updateGameScreen(gameState);
            } else if (gameState.status === 'meeting') {
                this.showMeetingScreen(gameState);
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
                        <div class="setting-group">
                            <label>Tasks per Crewmate:</label>
                            <input type="number" id="num-tasks" value="5" min="3" max="10">
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
            document.getElementById('num-tasks').addEventListener('change', (e) => {
                this.gameRef.child('settings/numTasks').set(parseInt(e.target.value));
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

        // Generate tasks for crewmates
        const allTasks = [
            'Fix Wiring', 'Download Data', 'Empty Garbage', 'Fuel Engines',
            'Submit Scan', 'Clean Vents', 'Align Engine', 'Calibrate Distributor',
            'Chart Course', 'Divert Power', 'Inspect Sample', 'Prime Shields',
            'Stabilize Steering', 'Swipe Card', 'Unlock Manifolds', 'Upload Data'
        ];

        const updates = {};
        players.forEach(playerId => {
            const isImpostor = impostors.includes(playerId);
            updates[`players/${playerId}/role`] = isImpostor ? 'impostor' : 'crewmate';
            
            if (!isImpostor) {
                const playerTasks = [...allTasks]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, gameState.settings.numTasks)
                    .map(task => ({ name: task, completed: false }));
                updates[`players/${playerId}/tasks`] = playerTasks;
            }
        });

        updates['status'] = 'playing';
        updates['sabotageActive'] = false;
        
        await this.gameRef.update(updates);
    }

    updateGameScreen(gameState) {
        const player = gameState.players[this.playerId];
        const isImpostor = player.role === 'impostor';
        const isAlive = player.alive;

        // Handle sabotage (black screen for crewmates)
        if (gameState.sabotageActive && !isImpostor && isAlive) {
            this.container.innerHTML = `
                <div class="sabotage-screen">
                    <h2 style="color: red;">🚨 SABOTAGE! 🚨</h2>
                    <p>Systems are down! Impostors have sabotaged the ship!</p>
                    <p class="sabotage-timer">Waiting for fix...</p>
                </div>
            `;
            return;
        }

        const alivePlayers = Object.entries(gameState.players).filter(([_, p]) => p.alive);
        const aliveCrewmates = alivePlayers.filter(([_, p]) => p.role === 'crewmate').length;
        const aliveImpostors = alivePlayers.filter(([_, p]) => p.role === 'impostor').length;

        // Check win conditions
        if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
            this.gameRef.update({ status: 'ended', winner: 'impostors' });
            return;
        }

        const totalTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
        const completedTasks = Object.values(gameState.players)
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + (p.tasksCompleted || 0), 0);

        if (totalTasks > 0 && completedTasks >= totalTasks) {
            this.gameRef.update({ status: 'ended', winner: 'crewmates' });
            return;
        }

        this.container.innerHTML = `
            <div class="amongus-game ${!isAlive ? 'ghost-mode' : ''}">
                <div class="game-header">
                    <h3>${this.gameData.name}</h3>
                    <div class="role-display ${isImpostor ? 'impostor' : 'crewmate'}">
                        ${isImpostor ? '🔪 IMPOSTOR' : '👷 CREWMATE'}
                        ${!isAlive ? ' 👻 (GHOST)' : ''}
                    </div>
                </div>

                <div class="game-stats">
                    <div class="stat">
                        <strong>Alive:</strong> ${alivePlayers.length}
                    </div>
                    ${!isImpostor ? `
                        <div class="stat">
                            <strong>Tasks:</strong> ${completedTasks}/${totalTasks}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(completedTasks/totalTasks*100).toFixed(1)}%"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                ${isAlive ? `
                    <div class="action-buttons">
                        ${isImpostor ? `
                            <button id="kill-btn" class="btn btn-danger">🔪 Kill</button>
                            <button id="sabotage-btn" class="btn btn-danger">⚡ Sabotage</button>
                        ` : `
                            <div id="tasks-list"></div>
                        `}
                        <button id="meeting-btn" class="btn btn-primary">🚨 Emergency Meeting</button>
                    </div>
                ` : '<p class="ghost-message">You are a ghost. You can still see everything and do tasks, but cannot interact.</p>'}

                <div id="players-list"></div>
            </div>
        `;

        this.updatePlayersList(gameState);
        
        if (isAlive) {
            if (isImpostor) {
                document.getElementById('kill-btn')?.addEventListener('click', () => this.showKillMenu(gameState));
                document.getElementById('sabotage-btn')?.addEventListener('click', () => this.activateSabotage());
            } else {
                this.renderTasks(player);
            }
            document.getElementById('meeting-btn')?.addEventListener('click', () => this.callMeeting());
        }
    }

    renderTasks(player) {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;

        tasksList.innerHTML = `
            <h4>Your Tasks:</h4>
            <div class="tasks-container">
                ${(player.tasks || []).map((task, index) => `
                    <div class="task-item ${task.completed ? 'completed' : ''}">
                        <label>
                            <input type="checkbox" 
                                ${task.completed ? 'checked disabled' : ''} 
                                data-task-index="${index}">
                            ${task.name}
                        </label>
                    </div>
                `).join('')}
            </div>
        `;

        document.querySelectorAll('.task-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const index = parseInt(e.target.dataset.taskIndex);
                    this.completeTask(index);
                }
            });
        });
    }

    async completeTask(taskIndex) {
        const snapshot = await this.gameRef.child(`players/${this.playerId}`).once('value');
        const player = snapshot.val();
        
        if (player.tasks[taskIndex]) {
            player.tasks[taskIndex].completed = true;
            const tasksCompleted = player.tasks.filter(t => t.completed).length;
            
            await this.gameRef.child(`players/${this.playerId}`).update({
                tasks: player.tasks,
                tasksCompleted: tasksCompleted
            });
        }
    }

    showKillMenu(gameState) {
        const alivePlayers = Object.entries(gameState.players)
            .filter(([id, p]) => p.alive && id !== this.playerId && p.role !== 'impostor');

        if (alivePlayers.length === 0) {
            alert('No one nearby to eliminate!');
            return;
        }

        const playerToKill = alivePlayers[Math.floor(Math.random() * alivePlayers.length)][0];
        
        if (confirm(`Eliminate ${gameState.players[playerToKill].name}?`)) {
            this.gameRef.child(`players/${playerToKill}/alive`).set(false);
        }
    }

    async activateSabotage() {
        await this.gameRef.update({ sabotageActive: true });
        
        // Auto-fix after 10 seconds
        setTimeout(async () => {
            const snapshot = await this.gameRef.child('sabotageActive').once('value');
            if (snapshot.val()) {
                await this.gameRef.update({ sabotageActive: false });
            }
        }, 10000);
    }

    async callMeeting() {
        await this.gameRef.update({ 
            status: 'meeting',
            votes: {},
            meetingCaller: this.playerId
        });
    }

    updatePlayersList(gameState) {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        const player = gameState.players[this.playerId];
        const isImpostor = player.role === 'impostor';
        const players = Object.entries(gameState.players);

        playersList.innerHTML = `
            <h4>Players:</h4>
            <div class="players-grid">
                ${players.map(([id, p]) => `
                    <div class="player-card ${!p.alive ? 'dead' : ''}">
                        <span class="player-status">${p.alive ? '✅' : '💀'}</span>
                        <span class="player-name">${p.name}</span>
                        ${isImpostor && p.role === 'impostor' && id !== this.playerId ? 
                            '<span class="impostor-badge">🔪</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    showMeetingScreen(gameState) {
        const player = gameState.players[this.playerId];
        const caller = gameState.players[gameState.meetingCaller];
        const alivePlayers = Object.entries(gameState.players).filter(([_, p]) => p.alive);

        this.container.innerHTML = `
            <div class="meeting-screen">
                <h3>🚨 Emergency Meeting 🚨</h3>
                <p class="meeting-caller">Called by: ${caller?.name || 'Unknown'}</p>
                
                <div class="discussion-phase">
                    <h4>Discussion Time</h4>
                    <p>Discuss who might be the impostor!</p>
                </div>

                ${player.alive && !player.votedFor ? `
                    <div class="voting-section">
                        <h4>Vote to Eliminate:</h4>
                        <div class="vote-buttons">
                            ${alivePlayers.map(([id, p]) => `
                                <button class="vote-btn" data-player-id="${id}">
                                    ${p.name}
                                </button>
                            `).join('')}
                            <button class="vote-btn" data-player-id="skip">Skip Vote</button>
                        </div>
                    </div>
                ` : '<p class="voted-message">You have voted. Waiting for others...</p>'}

                <div id="vote-status"></div>
            </div>
        `;

        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const votedFor = e.target.dataset.playerId;
                this.castVote(votedFor);
            });
        });

        this.updateVoteStatus(gameState);
    }

    async castVote(playerId) {
        await this.gameRef.child(`players/${this.playerId}/votedFor`).set(playerId);
        await this.gameRef.child(`votes/${playerId}`).transaction(current => (current || 0) + 1);

        // Check if all alive players have voted
        const snapshot = await this.gameRef.once('value');
        const gameState = snapshot.val();
        const alivePlayers = Object.values(gameState.players).filter(p => p.alive);
        const votedPlayers = alivePlayers.filter(p => p.votedFor);

        if (votedPlayers.length === alivePlayers.length) {
            this.endVoting(gameState);
        }
    }

    updateVoteStatus(gameState) {
        const statusDiv = document.getElementById('vote-status');
        if (!statusDiv) return;

        const alivePlayers = Object.values(gameState.players).filter(p => p.alive);
        const votedPlayers = alivePlayers.filter(p => p.votedFor);

        statusDiv.innerHTML = `
            <p class="vote-count">Votes: ${votedPlayers.length}/${alivePlayers.length}</p>
        `;
    }

    async endVoting(gameState) {
        const votes = gameState.votes || {};
        const maxVotes = Math.max(...Object.values(votes));
        const eliminated = Object.entries(votes)
            .filter(([_, count]) => count === maxVotes)
            .map(([id, _]) => id);

        // If tie or skip wins, no one is eliminated
        if (eliminated.length > 1 || eliminated[0] === 'skip') {
            alert('No one was eliminated (tie or skip vote)');
        } else {
            const playerName = gameState.players[eliminated[0]]?.name || 'Unknown';
            const playerRole = gameState.players[eliminated[0]]?.role || 'unknown';
            alert(`${playerName} was eliminated! They were a ${playerRole.toUpperCase()}.`);
            await this.gameRef.child(`players/${eliminated[0]}/alive`).set(false);
        }

        // Reset votes and return to game
        const updates = {};
        Object.keys(gameState.players).forEach(id => {
            updates[`players/${id}/votedFor`] = null;
        });
        updates['votes'] = {};
        updates['status'] = 'playing';
        updates['meetingCaller'] = null;

        await this.gameRef.update(updates);
    }

    showGameOver(gameState) {
        const winner = gameState.winner;
        
        this.container.innerHTML = `
            <div class="game-over-screen">
                <h2>Game Over!</h2>
                <h3 class="${winner}-win">${winner === 'impostors' ? '🔪 Impostors' : '👷 Crewmates'} Win!</h3>
                
                <div class="final-roles">
                    <h4>Roles Revealed:</h4>
                    ${Object.entries(gameState.players).map(([id, p]) => `
                        <div class="player-final ${p.role}">
                            ${p.name}: ${p.role === 'impostor' ? '🔪 IMPOSTOR' : '👷 CREWMATE'}
                        </div>
                    `).join('')}
                </div>

                ${this.isHost ? `
                    <button id="new-game-btn" class="btn btn-primary">Start New Game</button>
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
