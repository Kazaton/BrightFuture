// src/app/game/GameClient.tsx
"use client";

import React, { useState } from 'react';
import axios from 'axios';

interface Message {
  text: string;
  isUser: boolean;
}

const GameClient: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');

  const sendMessage = async (): Promise<void> => {
    if (inputMessage.trim() === '') return;

    const newMessage: Message = { text: inputMessage, isUser: true };
    setMessages([...messages, newMessage]);
    setInputMessage('');

    try {
      const response = await axios.post<{ message: string }>('/api/chat', { message: inputMessage });
      const gptResponse: Message = { text: response.data.message, isUser: false };
      setMessages(prevMessages => [...prevMessages, gptResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div>
      <h1>Негры кабинет</h1>
      <div>
        <div>
          {messages.map((message, index) => (
            <div key={index} style={{ 
              marginBottom: '10px',
              textAlign: message.isUser ? 'right' : 'left',
              backgroundColor: message.isUser ? '#e6f2ff' : '#f0f0f0',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {message.text}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: '20px' }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && sendMessage()}
            placeholder="Введите сообщение..."
            style={{ flexGrow: 1, marginRight: '10px', padding: '8px' }}
          />
          <button onClick={sendMessage} style={{ padding: '8px 16px' }}>Отправить</button>
        </div>
      </div>
    </div>
  );
};

export default GameClient;