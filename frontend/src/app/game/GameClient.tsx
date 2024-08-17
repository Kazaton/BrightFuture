"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import API_ENDPOINTS from '@/lib/apiEndpoints';
import { getAccessToken } from '@/lib/authUtils';
import SidePanel from '@/components/SidePanel';

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
}

interface Chat {
  id: number;
  messages: Message[];
  is_finished: boolean;
  diagnosis: string | null;
  score: number | null;
  feedback: string | null;
  start_time: string;
}

const GameClient: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [pastGames, setPastGames] = useState<Chat[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      await axios.get(API_ENDPOINTS.MY_PROFILE, getAuthHeaders());
      setIsLoading(false);
      loadPastGames();
    } catch (error) {
      console.error('Authentication error:', error);
      router.push('/login');
    }
  };

  const getAuthHeaders = () => {
    const token = getAccessToken();
    return {
      headers: { Authorization: `Bearer ${token}` }
    };
  };

  const loadPastGames = async () => {
    try {
      const response = await axios.get<Chat[]>(API_ENDPOINTS.PAST_GAMES, getAuthHeaders());
      setPastGames(response.data);
      if (response.data.length > 0) {
        setChat(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading past games:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGame = async (gameId: number) => {
    setIsLoading(true);
    try {
      const response = await axios.get<Chat>(`${API_ENDPOINTS.CHATS}${gameId}/`, getAuthHeaders());
      setChat(response.data);
    } catch (error) {
      console.error('Error loading game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post<Chat>(
        API_ENDPOINTS.NEW_CHAT,
        { difficulty: 'easy' },
        getAuthHeaders()
      );
      setChat(response.data);
      setPastGames(prevGames => [response.data, ...prevGames]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    if (inputMessage.trim() === '' || !chat || chat.is_finished) return;

    setIsLoading(true);
    try {
      const response = await axios.post<Message>(
        API_ENDPOINTS.SEND_MESSAGE(chat.id),
        { content: inputMessage },
        getAuthHeaders()
      );
      setChat(prevChat => ({
        ...prevChat!,
        messages: [...prevChat!.messages, response.data]
      }));
      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  const endGame = async (): Promise<void> => {
    if (!chat || chat.is_finished) return;

    setIsLoading(true);
    try {
      const response = await axios.post<{ score: number; feedback: string }>(
        API_ENDPOINTS.END_GAME(chat.id),
        { answer: diagnosis },
        getAuthHeaders()
      );
      const updatedChat = {
        ...chat,
        is_finished: true,
        diagnosis: diagnosis,
        score: response.data.score,
        feedback: response.data.feedback
      };
      setChat(updatedChat);
      setPastGames(prevGames =>
        prevGames.map(game => game.id === chat.id ? updatedChat : game)
      );
    } catch (error) {
      console.error('Error ending game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !chat) {
    return <div>Загрузка...</div>;
  }

  return (
    <div style={{ display: 'flex' }}>
      <SidePanel
        games={pastGames}
        currentGameId={chat?.id || null}
        onGameSelect={loadGame}
        onNewGame={createNewChat}
      />
      <div style={{ flexGrow: 1, padding: '20px' }}>
        <h1>Виртуальный кабинет врача</h1>
        {chat ? (
          <div>
            <div>
              {chat.messages.map((message) => (
                <div key={message.id} style={{
                  marginBottom: '10px',
                  textAlign: message.sender === 'doctor' ? 'right' : 'left',
                  backgroundColor: message.sender === 'doctor' ? '#e6f2ff' : '#f0f0f0',
                  padding: '8px',
                  borderRadius: '5px'
                }}>
                  {message.content}
                </div>
              ))}
            </div>
            {!chat.is_finished ? (
              <div style={{ display: 'flex', marginTop: '20px' }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Введите сообщение..."
                  style={{ flexGrow: 1, marginRight: '10px', padding: '8px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  style={{ padding: '8px 16px' }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            ) : (
              <div>
                <h2>Игра завершена</h2>
                <p>Ваш диагноз: {chat.diagnosis}</p>
                <p>Оценка: {chat.score}</p>
                <p>Обратная связь: {chat.feedback}</p>
              </div>
            )}
            {!chat.is_finished && (
              <div style={{ marginTop: '20px' }}>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Введите ваш диагноз"
                  style={{ marginRight: '10px', padding: '8px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={endGame}
                  style={{ padding: '8px 16px' }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Завершение...' : 'Завершить игру'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p>У вас пока нет активных игр. Нажмите "Новая игра" в боковой панели, чтобы начать.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameClient;