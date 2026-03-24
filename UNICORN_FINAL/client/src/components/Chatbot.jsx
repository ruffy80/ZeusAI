
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
export default function Chatbot() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    try {
      const res = await axios.post('/api/uaic/ask', { type: 'simple', prompt: input, maxTokens: 200 });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I am having trouble right now.' }]);
    }
    setTimeout(scrollToBottom, 100);
  };
  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 bg-cyan-500 text-black p-4 rounded-full shadow-lg hover:bg-cyan-400 transition z-50">💬</button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-20 right-6 w-80 h-96 bg-gray-900 border border-cyan-500 rounded-xl shadow-2xl flex flex-col z-50">
            <div className="flex justify-between items-center p-3 border-b border-cyan-500"><h3 className="font-bold">{t('chatbot')}</h3><button onClick={() => setIsOpen(false)} className="text-white">&times;</button></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-2 rounded-lg ${msg.role === 'user' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-white'}`}>{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-gray-700 flex">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder={t('ask_zeus')} className="flex-1 p-2 bg-gray-800 rounded-l outline-none" />
              <button onClick={sendMessage} className="px-4 py-2 bg-cyan-500 text-black rounded-r">{t('send')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
