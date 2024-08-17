import React from 'react';

interface Game {
    id: number;
    start_time: string;
    diagnosis: string | null;
    score: number | null;
}

interface SidePanelProps {
    games: Game[];
    currentGameId: number | null;
    onGameSelect: (gameId: number) => void;
    onNewGame: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ games, currentGameId, onGameSelect, onNewGame }) => {
    return (
        <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '20px' }}>
            <h2>Прошлые игры</h2>
            {games.map((game) => (
                <div
                    key={game.id}
                    style={{
                        padding: '10px',
                        margin: '5px 0',
                        backgroundColor: game.id === currentGameId ? '#e6f2ff' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: '5px',
                    }}
                    onClick={() => onGameSelect(game.id)}
                >
                    <div>Дата: {new Date(game.start_time).toLocaleString()}</div>
                    <div>Диагноз: {game.diagnosis || 'Не завершено'}</div>
                    <div>Оценка: {game.score !== null ? game.score : 'Нет оценки'}</div>
                </div>
            ))}
            <button
                onClick={onNewGame}
                style={{ marginTop: '20px', padding: '10px', width: '100%' }}
            >
                Новая игра
            </button>
        </div>
    );
};

export default SidePanel;