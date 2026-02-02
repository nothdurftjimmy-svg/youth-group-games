// Youth Group Games App
class YouthGroupGamesApp {
    constructor() {
        this.games = this.loadGames();
        this.currentScreen = 'home-screen';
        this.currentGame = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderGames();
        this.showScreen('home-screen');
    }

    setupEventListeners() {
        // Add game button
        document.getElementById('add-game-btn').addEventListener('click', () => {
            this.showScreen('add-game-screen');
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showScreen('home-screen');
        });

        // Cancel game creation
        document.getElementById('cancel-game-btn').addEventListener('click', () => {
            this.showScreen('home-screen');
            document.getElementById('new-game-form').reset();
        });

        // New game form submission
        document.getElementById('new-game-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createGame();
        });
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show selected screen
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }

    loadGames() {
        const saved = localStorage.getItem('youthGroupGames');
        return saved ? JSON.parse(saved) : [];
    }

    saveGames() {
        localStorage.setItem('youthGroupGames', JSON.stringify(this.games));
    }

    createGame() {
        const name = document.getElementById('game-name').value;
        const type = document.getElementById('game-type').value;
        const description = document.getElementById('game-description').value;

        const game = {
            id: Date.now().toString(),
            name: name,
            type: type,
            description: description,
            createdAt: new Date().toISOString(),
            data: this.initializeGameData(type)
        };

        this.games.push(game);
        this.saveGames();
        this.renderGames();
        
        document.getElementById('new-game-form').reset();
        this.showScreen('home-screen');
    }

    initializeGameData(type) {
        switch(type) {
            case 'trivia':
                return { questions: [], scores: {} };
            case 'timer':
                return { duration: 60, isRunning: false };
            case 'random':
                return { items: [], history: [] };
            case 'points':
                return { teams: [], scores: {} };
            case 'custom':
                return { content: '' };
            default:
                return {};
        }
    }

    renderGames() {
        const container = document.getElementById('games-menu');
        
        if (this.games.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No games yet!</p>
                    <p>Click "Add New Game" to create your first game.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.games.map(game => `
            <div class="game-card" data-game-id="${game.id}">
                <button class="delete-game" data-game-id="${game.id}">×</button>
                <h3>${game.name}</h3>
                <p>${game.description || 'No description'}</p>
                <span class="game-type">${this.formatGameType(game.type)}</span>
            </div>
        `).join('');

        // Add click listeners to game cards
        container.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-game')) {
                    const gameId = card.dataset.gameId;
                    this.playGame(gameId);
                }
            });
        });

        // Add click listeners to delete buttons
        container.querySelectorAll('.delete-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameId = btn.dataset.gameId;
                this.deleteGame(gameId);
            });
        });
    }

    formatGameType(type) {
        const types = {
            'amongus': 'Among Us (Multiplayer)',
            'trivia': 'Trivia Quiz',
            'timer': 'Timer Challenge',
            'random': 'Random Picker',
            'points': 'Points Tracker',
            'custom': 'Custom Game'
        };
        return types[type] || type;
    }

    deleteGame(gameId) {
        if (confirm('Are you sure you want to delete this game?')) {
            this.games = this.games.filter(game => game.id !== gameId);
            this.saveGames();
            this.renderGames();
        }
    }

    playGame(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        this.currentGame = game;
        this.showScreen('game-screen');
        this.renderGameContent(game);
    }

    renderGameContent(game) {
        const container = document.getElementById('game-container');
        
        switch(game.type) {
            case 'amongus':
                new AmongUsGame(game, container);
                break;
            case 'trivia':
                container.innerHTML = this.renderTriviaGame(game);
                break;
            case 'timer':
                container.innerHTML = this.renderTimerGame(game);
                this.setupTimerControls(game);
                break;
            case 'random':
                container.innerHTML = this.renderRandomPicker(game);
                this.setupRandomPickerControls(game);
                break;
            case 'points':
                container.innerHTML = this.renderPointsTracker(game);
                this.setupPointsControls(game);
                break;
            case 'custom':
                container.innerHTML = this.renderCustomGame(game);
                break;
            default:
                container.innerHTML = '<p>Game type not yet implemented.</p>';
        }
    }

    renderTriviaGame(game) {
        return `
            <div class="game-content">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <p style="margin-top: 2rem; color: #95a5a6;">
                    Trivia game functionality coming soon!<br>
                    You can add questions, track scores, and more.
                </p>
            </div>
        `;
    }

    renderTimerGame(game) {
        const duration = game.data.duration || 60;
        return `
            <div class="game-content">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <div style="text-align: center; margin-top: 2rem;">
                    <div id="timer-display" style="font-size: 4rem; font-weight: bold; color: #4a90e2; margin: 2rem 0;">
                        ${this.formatTime(duration)}
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button id="timer-start" class="btn btn-primary">Start</button>
                        <button id="timer-pause" class="btn btn-secondary" disabled>Pause</button>
                        <button id="timer-reset" class="btn btn-secondary">Reset</button>
                    </div>
                    <div style="margin-top: 2rem;">
                        <label>Duration (seconds): </label>
                        <input type="number" id="timer-duration" value="${duration}" min="1" style="padding: 0.5rem; margin-left: 0.5rem;">
                    </div>
                </div>
            </div>
        `;
    }

    renderRandomPicker(game) {
        const items = game.data.items || [];
        return `
            <div class="game-content">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <div style="margin-top: 2rem;">
                    <h4>Add Items to Pick From:</h4>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <input type="text" id="random-item-input" placeholder="Enter item name" style="flex: 1; padding: 0.5rem;">
                        <button id="add-random-item" class="btn btn-primary">Add</button>
                    </div>
                    <div id="random-items-list" style="margin-bottom: 1rem;">
                        ${items.map((item, i) => `
                            <div style="padding: 0.5rem; background: #f5f7fa; margin-bottom: 0.5rem; border-radius: 8px; display: flex; justify-content: space-between;">
                                <span>${item}</span>
                                <button class="delete-random-item" data-index="${i}" style="background: #e74c3c; color: white; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; cursor: pointer;">Delete</button>
                            </div>
                        `).join('')}
                    </div>
                    <button id="pick-random" class="btn btn-primary" ${items.length === 0 ? 'disabled' : ''}>Pick Random!</button>
                    <div id="random-result" style="margin-top: 1rem; font-size: 2rem; font-weight: bold; color: #4a90e2; min-height: 3rem;"></div>
                </div>
            </div>
        `;
    }

    renderPointsTracker(game) {
        const teams = game.data.teams || [];
        return `
            <div class="game-content">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <div style="margin-top: 2rem;">
                    <h4>Add Team:</h4>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <input type="text" id="team-name-input" placeholder="Team name" style="flex: 1; padding: 0.5rem;">
                        <button id="add-team" class="btn btn-primary">Add Team</button>
                    </div>
                    <div id="teams-list">
                        ${teams.map((team, i) => `
                            <div style="padding: 1rem; background: #f5f7fa; margin-bottom: 0.5rem; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong>${team.name}</strong>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <button class="points-minus" data-index="${i}" style="background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">-</button>
                                        <span style="font-size: 1.5rem; font-weight: bold; min-width: 50px; text-align: center;">${team.points || 0}</span>
                                        <button class="points-plus" data-index="${i}" style="background: #2ecc71; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">+</button>
                                        <button class="delete-team" data-index="${i}" style="background: #95a5a6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Delete</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderCustomGame(game) {
        return `
            <div class="game-content">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <p style="margin-top: 2rem; color: #95a5a6;">
                    Custom game space - you can extend this to add your own game logic!
                </p>
            </div>
        `;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    setupTimerControls(game) {
        let interval = null;
        let timeLeft = game.data.duration || 60;

        const display = document.getElementById('timer-display');
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        const resetBtn = document.getElementById('timer-reset');
        const durationInput = document.getElementById('timer-duration');

        startBtn.addEventListener('click', () => {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            
            interval = setInterval(() => {
                timeLeft--;
                display.textContent = this.formatTime(timeLeft);
                
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    alert('Time\'s up!');
                    startBtn.disabled = false;
                    pauseBtn.disabled = true;
                }
            }, 1000);
        });

        pauseBtn.addEventListener('click', () => {
            clearInterval(interval);
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        });

        resetBtn.addEventListener('click', () => {
            clearInterval(interval);
            timeLeft = parseInt(durationInput.value) || 60;
            display.textContent = this.formatTime(timeLeft);
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            game.data.duration = timeLeft;
            this.saveGames();
        });

        durationInput.addEventListener('change', () => {
            timeLeft = parseInt(durationInput.value) || 60;
            display.textContent = this.formatTime(timeLeft);
            game.data.duration = timeLeft;
            this.saveGames();
        });
    }

    setupRandomPickerControls(game) {
        const input = document.getElementById('random-item-input');
        const addBtn = document.getElementById('add-random-item');
        const pickBtn = document.getElementById('pick-random');
        const result = document.getElementById('random-result');

        const refreshList = () => {
            this.renderGameContent(game);
            this.setupRandomPickerControls(game);
        };

        addBtn.addEventListener('click', () => {
            const item = input.value.trim();
            if (item) {
                game.data.items.push(item);
                this.saveGames();
                input.value = '';
                refreshList();
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });

        document.querySelectorAll('.delete-random-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                game.data.items.splice(index, 1);
                this.saveGames();
                refreshList();
            });
        });

        pickBtn.addEventListener('click', () => {
            if (game.data.items.length > 0) {
                const randomItem = game.data.items[Math.floor(Math.random() * game.data.items.length)];
                result.textContent = `🎉 ${randomItem}`;
            }
        });
    }

    setupPointsControls(game) {
        const input = document.getElementById('team-name-input');
        const addBtn = document.getElementById('add-team');

        const refreshList = () => {
            this.renderGameContent(game);
            this.setupPointsControls(game);
        };

        addBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                game.data.teams.push({ name: name, points: 0 });
                this.saveGames();
                input.value = '';
                refreshList();
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });

        document.querySelectorAll('.points-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                game.data.teams[index].points = (game.data.teams[index].points || 0) + 1;
                this.saveGames();
                refreshList();
            });
        });

        document.querySelectorAll('.points-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                game.data.teams[index].points = Math.max(0, (game.data.teams[index].points || 0) - 1);
                this.saveGames();
                refreshList();
            });
        });

        document.querySelectorAll('.delete-team').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                game.data.teams.splice(index, 1);
                this.saveGames();
                refreshList();
            });
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new YouthGroupGamesApp();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
});
