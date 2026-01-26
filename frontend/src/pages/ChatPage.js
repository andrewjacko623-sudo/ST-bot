import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../config/supabase';
import './ChatPage.css';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper function to parse markdown images and extract URLs
  const parseMarkdownImages = (text) => {
    if (!text || typeof text !== 'string') {
      return { cleanedText: '', mediaUrls: [] };
    }
    
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const mediaUrls = [];
    let cleanedText = text;
    let match;

    // Extract all image URLs from markdown syntax
    while ((match = imageRegex.exec(text)) !== null) {
      const url = match[2];
      mediaUrls.push(url);
      // Remove the markdown image syntax from text
      cleanedText = cleanedText.replace(match[0], '');
    }

    return { cleanedText: cleanedText.trim(), mediaUrls };
  };

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('chat_history')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) {
          console.error('Error loading chat history:', error);
        } else if (data && data.length > 0) {
          // Convert database format to message format
          const loadedMessages = data.map(msg => {
            // Parse markdown images from stored messages
            const { cleanedText, mediaUrls } = parseMarkdownImages(msg.message);
            return {
              role: msg.role,
              content: cleanedText,
              media_urls: mediaUrls
            };
          });
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, []);

  const clearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      return;
    }

    try {
      // Delete all chat history from Supabase
      // Using a condition that matches all rows (id is not null, which is always true)
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .not('id', 'is', null);

      if (error) {
        console.error('Error clearing chat history:', error);
        alert('Failed to clear chat history: ' + error.message);
        return;
      }

      // Clear local messages state
      setMessages([]);
      alert('Chat history cleared successfully!');
    } catch (error) {
      console.error('Error clearing chat history:', error);
      alert('Failed to clear chat history');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        temperature: 0.7,
        max_tokens: 1000,
      });

      console.log('Response from backend:', response.data); // Debug log

      // Check if response has the expected structure
      if (!response.data || !response.data.response) {
        throw new Error('Invalid response format from backend');
      }

      // Parse markdown images from response
      const { cleanedText, mediaUrls: parsedUrls } = parseMarkdownImages(response.data.response);
      
      // Combine URLs from both the media_urls field and parsed markdown
      const allMediaUrls = [...(response.data.media_urls || []), ...parsedUrls];

      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: cleanedText || 'No response received',
          media_urls: allMediaUrls
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.response?.data?.detail || error.message || 'Unknown error'}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {messages.length > 0 && (
          <div className="chat-header">
            <h2>Chat</h2>
            <button
              className="clear-history-button"
              onClick={clearHistory}
              disabled={isLoading}
              title="Clear all chat history"
            >
              Clear History
            </button>
          </div>
        )}
        <div className="chat-messages">
          {isLoadingHistory ? (
            <div className="welcome-message">
              <h2>Loading chat history...</h2>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome-message">
              <h2>Welcome to the Chat!</h2>
              <p>Start a conversation with the bot by typing a message below.</p>
            </div>
          ) : null}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                <div className="message-role">
                  {msg.role === 'user' ? 'You' : 'Daddy'}
                </div>
                <div className="message-text">{msg.content}</div>
                {msg.media_urls && msg.media_urls.length > 0 && (
                  <div className="message-media">
                    {msg.media_urls.map((url, idx) => {
                      const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('video');
                      return isVideo ? (
                        <video key={idx} src={url} controls className="media-content" />
                      ) : (
                        <img key={idx} src={url} alt="Media" className="media-content" />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="message-role">Daddy</div>
                <div className="message-text">
                  <span className="typing-indicator">...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input-form" onSubmit={sendMessage}>
          <input
            type="text"
            className="chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message here..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={isLoading || !inputMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
