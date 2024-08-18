"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import API_ENDPOINTS from '@/lib/apiEndpoints';
import { getAccessToken, logout, refreshAccessToken } from '@/lib/authUtils';
import SidePanel from '@/components/SidePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  isResultMessage?: boolean;
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkAuthentication = async () => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      await axios.get(API_ENDPOINTS.MY_PROFILE, getAuthHeaders());
      loadPastGames();
    } catch (error) {
      console.error('Authentication error:', error);
      handleAuthError();
    }
  };

  const getAuthHeaders = () => {
    const token = getAccessToken();
    return {
      headers: { Authorization: `Bearer ${token}` }
    };
  };

  const handleAuthError = async () => {
    try {
      await refreshAccessToken();
      // Если обновление токена успешно, повторно загрузим данные
      loadPastGames();
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      logout();
      setChat(null);
      setPastGames([]);
      setError('Ошибка аутентификации. Пожалуйста, войдите снова.');
      router.push('/login');
    }
  };

  const loadPastGames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<Chat[]>(API_ENDPOINTS.PAST_GAMES, getAuthHeaders());
      setPastGames(response.data);
      if (response.data.length > 0) {
        setChat(response.data[0]);
      } else {
        setChat({
          id: 0,
          messages: [{
            id: 0,
            sender: 'patient',
            content: 'У вас пока нет активных игр. Нажмите "Новая игра" в боковой панели, чтобы начать.',
            timestamp: new Date().toISOString()
          }],
          is_finished: false,
          diagnosis: null,
          score: null,
          feedback: null,
          start_time: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error loading past games:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await handleAuthError();
      } else {
        setError('Ошибка при загрузке прошлых игр. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadGame = async (gameId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<Chat>(`${API_ENDPOINTS.CHATS}${gameId}/`, getAuthHeaders());
      setChat(response.data);
    } catch (error) {
      console.error('Error loading game:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        handleAuthError();
      } else {
        setError('Ошибка при загрузке игры. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async (difficulty: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post<Chat>(
        API_ENDPOINTS.NEW_CHAT,
        { difficulty },
        getAuthHeaders()
      );
      setChat(response.data);
      setPastGames(prevGames => [response.data, ...prevGames]);
    } catch (error) {
      console.error('Error creating new chat:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        handleAuthError();
      } else {
        setError('Ошибка при создании новой игры. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (inputMessage.trim() === '' || !chat || chat.is_finished) return;

    setIsLoading(true);
    setError(null);

    // Создаем временное сообщение врача
    const tempDoctorMessage: Message = {
      id: Date.now(), // Временный ID
      sender: 'doctor',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    // Немедленно обновляем локальное состояние
    setChat(prevChat => ({
      ...prevChat!,
      messages: [...prevChat!.messages, tempDoctorMessage]
    }));

    try {
      const response = await axios.post<Message>(
        API_ENDPOINTS.SEND_MESSAGE(chat.id),
        { content: inputMessage },
        getAuthHeaders()
      );

      // Обновляем чат с ответом пациента
      setChat(prevChat => ({
        ...prevChat!,
        messages: [...prevChat!.messages, response.data]
      }));

      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await handleAuthError();
      } else {
        setError('Ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.');
        setChat(prevChat => ({
          ...prevChat!,
          messages: prevChat!.messages.filter(msg => msg.id !== tempDoctorMessage.id)
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const endGame = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!chat || chat.is_finished) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post<{ score: number; feedback: string }>(
        API_ENDPOINTS.END_GAME(chat.id),
        { answer: diagnosis },
        getAuthHeaders()
      );

      const resultMessage: Message = {
        id: Date.now(),
        sender: 'system',
        content: `Игра завершена. Диагноз: ${diagnosis}. Оценка: ${response.data.score}. Обратная связь: ${response.data.feedback}`,
        timestamp: new Date().toISOString(),
        isResultMessage: true
      };

      const updatedChat = {
        ...chat,
        is_finished: true,
        diagnosis: diagnosis,
        score: response.data.score,
        feedback: response.data.feedback,
        messages: [...chat.messages, resultMessage]
      };

      await saveUpdatedChat(updatedChat);

      setChat(updatedChat);
      setPastGames(prevGames =>
        prevGames.map(game => game.id === chat.id ? updatedChat : game)
      );

      setDiagnosis('');
    } catch (error) {
      console.error('Error ending game:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        handleAuthError();
      } else {
        setError('Ошибка при завершении игры. Пожалуйста, попробуйте еще раз.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveUpdatedChat = async (updatedChat: Chat) => {
    try {
      await axios.put(`${API_ENDPOINTS.CHATS}${updatedChat.id}/`, updatedChat, getAuthHeaders());
    } catch (error) {
      console.error('Error saving updated chat:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        handleAuthError();
      } else {
        setError('Ошибка при сохранении результатов игры. Пожалуйста, попробуйте еще раз.');
      }
    }
  };

  const handleLogout = () => {
    logout();
    setChat(null);
    setPastGames([]);
    router.push('/login');
  };



  return (
    <div className="flex h-screen bg-gray-100">
      <SidePanel
        games={pastGames}
        currentGameId={chat?.id || null}
        onGameSelect={loadGame}
        onNewGame={createNewChat}
      />
      <div className="flex-grow flex flex-col overflow-hidden w-4/5">
        <div className="bg-white shadow-md p-4">
          <h1 className="text-2xl font-bold">Виртуальный кабинет врача</h1>
        </div>
        <div className="flex-grow overflow-y-auto p-4">
          {chat && (
            <>
              {chat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 ${message.sender === 'doctor' ? 'text-right' : 'text-left'
                    }`}
                >
                  <div
                    className={`inline-block p-3 rounded-lg ${message.sender === 'doctor'
                      ? 'bg-blue-500 text-white'
                      : message.isResultMessage
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-black'
                      }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        {chat && !chat.is_finished && (
          <div className="p-4 bg-white border-t space-y-2">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-grow"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-32">
                {isLoading ? 'Отправка...' : 'Отправить'}
              </Button>
            </form>
            <form onSubmit={endGame} className="flex space-x-2">
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Введите ваш диагноз"
                className="flex-grow"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-32">
                {isLoading ? 'Завершение...' : 'Завершить игру'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameClient;