// components/Chatbot.tsx
import React, { useState, useRef, useEffect } from 'react';
import Spinner from './Spinner';
import { ChatBubbleLeftRightIcon } from './icons/ChatBubbleLeftRightIcon';
import { DappRegistered } from '../types';
import ChatDappCard from './ChatDappCard';

const API_BASE_URL = 'http://localhost:3001/api';

interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    dapps?: DappRegistered[];
    hasMore?: boolean;
}

export const Chatbot: React.FC<{ onClose: () => void, onNavigateToDetail: (dappId: string) => void }> = ({ onClose, onNavigateToDetail }) => {
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHistory([
            {
                role: 'model',
                parts: [{ text: "Welcome to RateCaster! I can help you find the best dApps. What are you looking for?" }]
            }
        ]);
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const sendMessage = async (messageText = message, isLoadMore = false) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
        let newHistory = [...history, userMessage];

        if (isLoadMore) {
            const lastModelMessage = history.slice().reverse().find(m => m.role === 'model' && m.dapps);
            if (lastModelMessage && lastModelMessage.dapps) {
                const offset = lastModelMessage.dapps.length;
                messageText = `show me more dapps from offset ${offset}`;
            }
        }

        setHistory(newHistory);
        setMessage('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/chatbot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    history: history.slice(1), // Exclude the initial welcome message
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to get response from the chatbot.');
            }

            const data = await res.json();
            let modelResponse = data.response;

            // Clean the response from markdown
            if (modelResponse.startsWith('```json')) {
                modelResponse = modelResponse.slice(7, -4);
            }

            try {
                const parsedResponse = JSON.parse(modelResponse);
                if (parsedResponse.dapps && parsedResponse.dapps.length > 0) {
                    const modelMessage: ChatMessage = { 
                        role: 'model', 
                        parts: [{ text: 'Here are some dapps I found for you:' }],
                        dapps: parsedResponse.dapps,
                        hasMore: parsedResponse.hasMore
                    };
                    setHistory([...newHistory, modelMessage]);
                } else {
                    const modelMessage: ChatMessage = { role: 'model', parts: [{ text: "I couldn't find any dApps matching your request. Please try a different search." }] };
                    setHistory([...newHistory, modelMessage]);
                }
            } catch (e) {
                const modelMessage: ChatMessage = { role: 'model', parts: [{ text: modelResponse }] };
                setHistory([...newHistory, modelMessage]);
            }

        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "Sorry, I'm having trouble connecting. Please try again later." }] };
            setHistory([...newHistory, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-20 right-4 w-96 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg flex flex-col h-[600px] z-50">
            <header className="flex items-center justify-between p-4 border-b border-neutral-700">
                <h2 className="text-lg font-bold text-yellow-500">RateCaster Assistant</h2>
                <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl leading-none">&times;</button>
            </header>

            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto">
                {history.map((msg, index) => (
                    <div key={index}>
                        <div className={`my-2 p-3 rounded-lg max-w-xs break-words ${
                            msg.role === 'user'
                                ? 'bg-blue-600 ml-auto text-white'
                                : 'bg-neutral-700 mr-auto text-neutral-200'
                        }`}>
                            <p className="text-sm">{msg.parts[0].text}</p>
                        </div>
                        {msg.dapps && (
                            <div className="grid grid-cols-1 gap-2 mt-2">
                                {msg.dapps.map(dapp => (
                                    <ChatDappCard key={dapp.dappId} dapp={dapp} onNavigateToDetail={onNavigateToDetail} />
                                ))}
                            </div>
                        )}
                        {msg.hasMore && (
                            <button 
                                onClick={() => sendMessage(`show me more dapps`, true)}
                                className="text-yellow-500 text-sm mt-2"
                            >
                                Load More
                            </button>
                        )}
                    </div>
                ))}
                 {isLoading && (
                    <div className="my-2 p-3 rounded-lg max-w-xs bg-neutral-700 mr-auto flex justify-center">
                        <Spinner size="sm" />
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-neutral-700">
                <div className="flex">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask about dApps..."
                        className="flex-1 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-l-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={() => sendMessage()}
                        className="px-4 py-2 bg-yellow-500 text-neutral-900 font-bold rounded-r-lg hover:bg-yellow-400 disabled:bg-neutral-600"
                        disabled={isLoading}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};