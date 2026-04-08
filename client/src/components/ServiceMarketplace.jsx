import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PaymentModal from './PaymentModal';

export default function ServiceMarketplace({ clientId }) {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [purchaseNotice, setPurchaseNotice] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const fetchData = async () => {
    try {
      const recRequest = clientId ? axios.get('/api/marketplace/recommendations/' + clientId) : Promise.resolve({ data: { recommendations: [] } });
      const [servicesRes, categoriesRes, statsRes, recRes] = await Promise.all([
        axios.get('/api/marketplace/services'),
        axios.get('/api/marketplace/categories'),
        axios.get('/api/marketplace/stats'),
        recRequest
      ]);

      setServices(servicesRes.data.services || []);
      setCategories(categoriesRes.data.categories || {});
      setStats(statsRes.data || null);
      setRecommendations(recRes.data.recommendations || []);

      const pricePromises = (servicesRes.data.services || []).map(async (service) => {
        const priceRes = await axios.post('/api/marketplace/price', {
          serviceId: service.id,
          clientId: clientId || 'guest',
          clientData: { segment: 'retail' }
        });
        return { id: service.id, price: priceRes.data.personalizedPrice };
      });

      const priceResults = await Promise.all(pricePromises);
      const priceMap = {};
      priceResults.forEach(p => { priceMap[p.id] = p.price; });
      setPrices(priceMap);
    } catch (err) {
      console.error('Eroare la încărcarea serviciilor:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = (service, price) => {
    setSelectedOffer({
      serviceId: service.id,
      serviceName: service.name,
      price: Number(price || 0),
      description: service.description || service.name
    });
    setPurchaseNotice('');
    setCheckoutOpen(true);
  };

  const handlePurchaseComplete = async (payment) => {
    if (!selectedOffer) return;
    try {
      await axios.post('/api/marketplace/purchase', {
        serviceId: selectedOffer.serviceId,
        clientId: clientId || 'guest',
        price: selectedOffer.price,
        paymentTxId: payment.txId,
        paymentMethod: payment.method,
        serviceName: selectedOffer.serviceName,
        description: selectedOffer.description
      });
      setPurchaseNotice('Payment confirmed for ' + selectedOffer.serviceName + '. Service activated successfully.');
      setCheckoutOpen(false);
      setSelectedOffer(null);
      fetchData();
    } catch (err) {
      setPurchaseNotice('Payment succeeded, but marketplace activation failed. Please retry activation.');
    }
  };

  const filteredServices = selectedCategory === 'all' ? services : services.filter(s => s.category === selectedCategory);
  if (loading) return <div className="text-center p-12">Loading services...</div>;

  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">AI Services Marketplace</h2>

      {purchaseNotice && (
        <div className="mb-6 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-cyan-200">
          {purchaseNotice}
        </div>
      )}

      {stats && (
        <div className="bg-gray-800/50 p-4 rounded-xl mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="text-cyan-400">Total Services:</span> {stats.totalServices}</div>
            <div><span className="text-cyan-400">Avg Price:</span> ${Number(stats.avgPrice || 0).toFixed(2)}</div>
            <div><span className="text-cyan-400">Discount:</span> {stats.discountRate}%</div>
            <div><span className="text-cyan-400">Last Update:</span> {stats.lastMarketUpdate ? new Date(stats.lastMarketUpdate).toLocaleTimeString() : '-'}</div>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold mb-4">🎯 Recommended for You</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map(rec => (
              <div key={rec.serviceId} className="bg-purple-500/20 p-4 rounded-xl border border-purple-500">
                <h4 className="text-lg font-bold">{rec.name}</h4>
                <p className="text-sm text-gray-300">{rec.reason}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-xl font-bold text-cyan-400">${prices[rec.serviceId] ? Number(prices[rec.serviceId]).toFixed(2) : '0.00'}</span>
                  <button onClick={() => openCheckout({ id: rec.serviceId, name: rec.name, description: rec.reason }, prices[rec.serviceId])} className="px-4 py-2 bg-purple-500 text-black rounded hover:bg-purple-400">
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setSelectedCategory('all')} className={selectedCategory === 'all' ? 'px-4 py-2 rounded bg-cyan-500 text-black' : 'px-4 py-2 rounded bg-gray-700'}>
          All
        </button>
        {Object.keys(categories).map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={selectedCategory === cat ? 'px-4 py-2 rounded capitalize bg-cyan-500 text-black' : 'px-4 py-2 rounded capitalize bg-gray-700'}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => (
          <div key={service.id} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-cyan-400">{service.name}</h3>
            <p className="text-gray-300 text-sm mt-2">{service.description}</p>
            <div className="mt-4 flex justify-between items-center">
              <div>
                <span className="text-2xl font-bold text-white">${prices[service.id] ? Number(prices[service.id]).toFixed(2) : '0.00'}</span>
                <span className="text-sm text-gray-400 line-through ml-2">${service.basePrice ? Number(service.basePrice).toFixed(2) : '0.00'}</span>
                <span className="text-green-400 text-sm ml-2">-{service.discount}%</span>
              </div>
              <button onClick={() => openCheckout(service, prices[service.id])} className="px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400 transition">
                Buy Now
              </button>
            </div>
            {service.demand > 0.7 && <div className="mt-2 text-xs text-orange-400">🔥 High demand</div>}
          </div>
        ))}
      </div>

      <PaymentModal
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setSelectedOffer(null);
        }}
        presetAmount={selectedOffer?.price || 0}
        presetDescription={selectedOffer ? selectedOffer.serviceName + ' · Marketplace Service' : 'Marketplace Service'}
        clientId={clientId || 'guest'}
        metadata={selectedOffer ? {
          source: 'marketplace',
          serviceId: selectedOffer.serviceId,
          serviceName: selectedOffer.serviceName,
          description: selectedOffer.description
        } : { source: 'marketplace' }}
        onCompleted={handlePurchaseComplete}
      />
    </div>
  );
}
