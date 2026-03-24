
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode.react';
const BTC_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
export default function Payment() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(0.01);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const checkPayment = () => {
    setPaymentStatus('waiting');
    setTimeout(() => { setPaymentStatus('confirmed'); alert('Payment confirmed!'); }, 10000);
  };
  return (
    <div className="p-8 max-w-md mx-auto"><h2 className="text-4xl font-bold mb-6 neon-text">{t('payment_title')}</h2>
      <div className="bg-gray-800/50 p-6 rounded-xl"><label className="block mb-2">{t('payment_amount')}</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full p-2 bg-gray-700 rounded mb-4" />
        <div className="text-center"><QRCode value={`bitcoin:${BTC_ADDRESS}?amount=${amount}`} size={200} />
          <p className="mt-2 break-all text-sm">Address: {BTC_ADDRESS}</p>
          <button onClick={checkPayment} className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400">{t('generate_address')}</button>
          <p className="text-cyan-300 mt-2">Status: {paymentStatus}</p>
        </div>
      </div>
    </div>
  );
}
