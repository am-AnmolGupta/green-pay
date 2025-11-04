import React, { useEffect, useState, useRef } from "react";

// GreenPe Prototype - single-file React component
// TailwindCSS assumed available in the environment (Lovable preview)
// Features implemented (mocked):
// - Aadhaar KYC onboarding (mock)
// - Energy ID creation
// - Meter simulator (live kWh feed)
// - Tokenization engine (0.001 REC per kWh, 0.8 kg CO2e per kWh)
// - Marketplace with orderbook & UPI-like mock settlement
// - Green Impact Certificate (GIC) generation (downloads JSON/PDF blob)
// - Simple GreenScore and loan eligibility indicator

export default function GreenPePrototype() {
  // --- User & Onboarding state ---
  const [user, setUser] = useState(null); // {energyId, name, aadhaarHash, gstin}
  const [showOnboard, setShowOnboard] = useState(true);

  // --- Meter simulation ---
  const [kwhTotal, setKwhTotal] = useState(0); // cumulative generated kWh
  const [lastReading, setLastReading] = useState(0); // last tick kWh
  const [isMeterRunning, setIsMeterRunning] = useState(false);
  const meterInterval = useRef(null);

  // --- Wallet & tokens ---
  const [recBalance, setRecBalance] = useState(0); // REC units (1 REC = 1000 kWh usual; here fractional)
  const [carbonKg, setCarbonKg] = useState(0); // kg CO2e
  const [inrBalance, setInrBalance] = useState(0);

  // --- Marketplace ---
  const [orders, setOrders] = useState([]); // sell orders {id, seller, rec, pricePerREC}
  const [tradeHistory, setTradeHistory] = useState([]);
  const [placePrice, setPlacePrice] = useState(5000);
  const [placeRECs, setPlaceRECs] = useState(0.05);

  // --- GIC ---
  const [gics, setGics] = useState([]);

  // --- GreenScore & loan ---
  const [greenScore, setGreenScore] = useState(0);

  // ---------- Helpers & Core Logic ----------
  const aadhaarHash = (aadhaar) => {
    if (!aadhaar) return null;
    // simple mock hash
    return `hash_${aadhaar.slice(-4)}`;
  };

  const createEnergyId = (name) => {
    const id = `${name.replace(/[^a-z0-9]/gi, "").toLowerCase()}@greenpe`;
    return id;
  };

  // Tokenization: 1 kWh -> 0.001 REC (by slide) and 0.8 kg CO2e
  const mintTokensForKwh = (kwh) => {
    const rec = +(kwh * 0.001).toFixed(6);
    const carbon = +(kwh * 0.8).toFixed(3);
    setRecBalance((r) => +(r + rec).toFixed(6));
    setCarbonKg((c) => +(c + carbon).toFixed(3));
  };

  // meter tick simulation
  useEffect(() => {
    if (isMeterRunning) {
      meterInterval.current = setInterval(() => {
        // simulate generated kWh in this tick: 0.1 - 1.2 kWh
        const tick = +(Math.random() * 1.1 + 0.1).toFixed(3);
        setLastReading(tick);
        setKwhTotal((k) => +(k + tick).toFixed(3));
        // mint tokens for exported kWh - for prototype consider all generated is exportable
        mintTokensForKwh(tick);
      }, 3000);
    }
    return () => clearInterval(meterInterval.current);
  }, [isMeterRunning]);

  // simple GreenScore: depends on volume & consistency (mock)
  useEffect(() => {
    const score = Math.min(1000, Math.round(Math.log(1 + kwhTotal) * 200 + recBalance * 50));
    setGreenScore(score);
  }, [kwhTotal, recBalance]);

  // Place sell order
  const placeSellOrder = () => {
    if (!user) return alert("Please onboard first");
    if (placeRECs <= 0 || placeRECs > recBalance) return alert("Invalid REC amount");
    const id = `ORD-${Date.now()}`;
    const order = {
      id,
      seller: user.energyId,
      rec: +placeRECs.toFixed(6),
      pricePerREC: +placePrice,
      createdAt: new Date().toISOString(),
    };
    setOrders((o) => [order, ...o]);
    setRecBalance((r) => +(r - order.rec).toFixed(6));
  };

  // Buy from order (mock UPI flow)
  const buyOrder = (order) => {
    // simulate UPI payment flow
    const paymentId = `UPI-${Date.now()}`;
    const total = +(order.rec * order.pricePerREC).toFixed(2);
    // do a 4-second fake payment
    const buyer = user ? user.energyId : "anonymous@greenpe";
    const trade = {
      id: `TRADE-${Date.now()}`,
      orderId: order.id,
      buyer,
      seller: order.seller,
      rec: order.rec,
      pricePerREC: order.pricePerREC,
      total,
      paymentId,
      timestamp: new Date().toISOString(),
    };

    // simulate settlement delay then credit seller INR and give buyer RECs
    setTradeHistory((t) => [trade, ...t]);
    // remove order
    setOrders((o) => o.filter((x) => x.id !== order.id));

    // settlement after 3s
    setTimeout(() => {
      // credit seller
      if (order.seller === (user && user.energyId)) {
        // if seller is current user
        setInrBalance((b) => +(b + total * 0.99).toFixed(2)); // 1% fee
      }
      // credit buyer RECs (if buyer is current user)
      if (buyer === (user && user.energyId)) {
        setRecBalance((r) => +(r + order.rec).toFixed(6));
      }
      alert(`Payment ${paymentId} settled: ₹${total}`);
    }, 3000);
  };

  // Generate GIC
  const generateGIC = () => {
    if (!user) return alert("Onboard to generate GIC");
    const gic = {
      gicId: `GIC-${Date.now()}`,
      issuer: "GreenPe:CERTv1",
      tokens: [],
      totalRec: +recBalance.toFixed(6),
      totalCarbonKg: +carbonKg.toFixed(3),
      generator: {
        energyId: user.energyId,
        aadhaar_hash: user.aadhaarHash,
        gstin: user.gstin || "NA",
      },
      compliance: {
        eu_cbam: true,
        generatedAt: new Date().toISOString(),
      },
    };
    setGics((g) => [gic, ...g]);

    // download JSON file
    const blob = new Blob([JSON.stringify(gic, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gic.gicId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mock onboarding submit
  const handleOnboard = (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value || "user";
    const aadhaar = form.aadhaar.value || "0000";
    const gstin = form.gstin.value || "";
    const energyId = createEnergyId(name);
    const aadHash = aadhaarHash(aadhaar);
    const newUser = { name, energyId, aadhaarHash: aadHash, gstin };
    setUser(newUser);
    setShowOnboard(false);
    alert(`Welcome! Your Energy ID: ${energyId}`);
  };

  // small sample marketplace seed
  useEffect(() => {
    setOrders([
      { id: "ORD-1", seller: "weaver_tirupur@greenpe", rec: 0.5, pricePerREC: 5200, createdAt: new Date().toISOString() },
      { id: "ORD-2", seller: "farmer_nashik@greenpe", rec: 0.2, pricePerREC: 4800, createdAt: new Date().toISOString() },
    ]);
  }, []);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600 text-white flex items-center justify-center font-bold">GP</div>
            <div>
              <div className="text-sm font-semibold">GreenPe Prototype</div>
              <div className="text-xs text-slate-500">Aadhaar + UPI-enabled energy token tests</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="text-sm text-slate-700">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-slate-500">{user.energyId}</div>
              </div>
            ) : (
              <button onClick={() => setShowOnboard(true)} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Onboard (Aadhaar)</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-12 gap-6">
        {/* Left: Dashboard */}
        <section className="col-span-8">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard title="kWh Generated" value={`${kwhTotal} kWh`} subtitle={`last +${lastReading} kWh`} />
            <StatCard title="REC Balance" value={`${recBalance} REC`} subtitle={`Carbon ${carbonKg} kg`} />
            <StatCard title="Wallet (INR)" value={`₹ ${inrBalance}`} subtitle={`GreenScore ${greenScore}`} />
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Meter Simulator</div>
              <div className="text-sm text-slate-500">Simulated IoT meter feed</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
                  <div style={{ width: `${Math.min(100, (kwhTotal % 100) / 1)}%` }} className="h-4 bg-green-400"></div>
                </div>
                <div className="text-xs text-slate-500 mt-2">Cumulative exports are tokenized into RECs & carbon</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMeterRunning(true)} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Start</button>
                <button onClick={() => setIsMeterRunning(false)} className="px-3 py-1 rounded bg-slate-200 text-slate-700 text-sm">Stop</button>
                <button onClick={() => { setKwhTotal(0); setRecBalance(0); setCarbonKg(0); }} className="px-3 py-1 rounded bg-red-50 text-red-600 text-sm">Reset</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Marketplace (Buy / Sell RECs)</div>
              <div className="text-xs text-slate-500">Fractional trades supported (≥ 0.001 REC)</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="p-3 border rounded mb-3">
                  <div className="text-xs text-slate-500 mb-1">Create Sell Order (use your REC balance)</div>
                  <div className="flex gap-2">
                    <input type="number" step="0.001" value={placeRECs} onChange={(e) => setPlaceRECs(+e.target.value)} className="flex-1 px-2 py-1 border rounded" />
                    <input type="number" value={placePrice} onChange={(e) => setPlacePrice(+e.target.value)} className="w-28 px-2 py-1 border rounded" />
                    <button onClick={placeSellOrder} className="px-3 py-1 rounded bg-green-600 text-white">Place</button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-auto">
                  {orders.length === 0 && <div className="text-xs text-slate-500">No sell orders</div>}
                  {orders.map((o) => (
                    <div key={o.id} className="p-2 border rounded flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{o.seller}</div>
                        <div className="text-xs text-slate-500">{o.rec} REC @ ₹{o.pricePerREC}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => buyOrder(o)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Buy</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="p-3 border rounded mb-3">
                  <div className="text-xs text-slate-500 mb-1">Trade History</div>
                  <div className="text-sm">{tradeHistory.length} trades</div>
                </div>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {tradeHistory.map((t) => (
                    <div key={t.id} className="p-2 border rounded">
                      <div className="flex justify-between">
                        <div className="text-sm">{t.buyer} → {t.seller}</div>
                        <div className="text-xs text-slate-500">{new Date(t.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-slate-600">{t.rec} REC · ₹{t.total}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Green Impact Certificates (GIC)</div>
              <div className="text-xs text-slate-500">Generate an export-ready certificate</div>
            </div>
            <div className="flex gap-3 items-center">
              <div>
                <div className="text-sm">Current Bundled Tokens</div>
                <div className="text-xs text-slate-500">REC: {recBalance} · Carbon: {carbonKg} kg</div>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={generateGIC} className="px-3 py-1 rounded bg-emerald-600 text-white">Generate GIC</button>
                <button onClick={() => setGics([])} className="px-3 py-1 rounded bg-slate-100">Clear</button>
              </div>
            </div>

            <div className="mt-3">
              {gics.length === 0 && <div className="text-xs text-slate-500">No GICs yet</div>}
              {gics.map((g) => (
                <div key={g.gicId} className="mt-2 p-2 border rounded">
                  <div className="flex justify-between">
                    <div className="font-medium">{g.gicId}</div>
                    <div className="text-xs text-slate-500">{new Date(g.compliance.generatedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-slate-600">REC: {g.totalRec} · CO₂: {g.totalCarbonKg} kg</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Panels */}
        <aside className="col-span-4 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="font-semibold mb-2">Profile & GreenScore</div>
            {!user ? (
              <div className="text-xs text-slate-500">Not onboarded</div>
            ) : (
              <div className="text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-slate-500">{user.energyId}</div>
                <div className="mt-2 text-xs">Aadhaar hash: {user.aadhaarHash}</div>
                <div className="mt-2">
                  <div className="text-xs text-slate-500">GreenScore</div>
                  <div className="text-lg font-semibold">{greenScore}</div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-slate-500">Loan eligibility</div>
                  <div className={`text-sm font-medium ${greenScore>300? 'text-emerald-600' : 'text-slate-500'}`}>{greenScore>300? 'Eligible' : 'Not Eligible'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="font-semibold mb-2">Quick Actions</div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowOnboard(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="px-3 py-2 rounded bg-green-600 text-white">Onboard / Update KYC</button>
              <button onClick={() => setIsMeterRunning((s)=>!s)} className="px-3 py-2 rounded bg-slate-100">Toggle Meter</button>
              <button onClick={() => { setInrBalance((b)=>b+500); alert('Mock: ₹500 credited via government subsidy'); }} className="px-3 py-2 rounded bg-slate-100">Simulate Subsidy</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="font-semibold mb-2">Recent Activity</div>
            <div className="text-xs text-slate-500">Orders: {orders.length} · Trades: {tradeHistory.length} · GICs: {gics.length}</div>
            <div className="mt-3 text-sm">
              <ul className="list-disc pl-5 space-y-2">
                <li>Fractional REC trading (≥0.001 REC)</li>
                <li>Aadhaar-linked Energy ID for every user</li>
                <li>UPI-like instant settlement simulation</li>
              </ul>
            </div>
          </div>
        </aside>
      </main>

      {/* Onboarding Modal */}
      {showOnboard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <form onSubmit={handleOnboard} className="bg-white rounded-lg p-6 w-full max-w-md shadow">
            <h3 className="text-lg font-semibold mb-2">Aadhaar KYC - Mock</h3>
            <p className="text-xs text-slate-500 mb-4">This is a simulated onboarding flow for prototype demo. No real Aadhaar calls are made.</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs">Name</label>
                <input name="name" className="w-full px-2 py-2 border rounded" placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs">Aadhaar (mock)</label>
                <input name="aadhaar" className="w-full px-2 py-2 border rounded" placeholder="1234" />
              </div>
              <div>
                <label className="text-xs">GSTIN (optional)</label>
                <input name="gstin" className="w-full px-2 py-2 border rounded" placeholder="22AAAAA0000A1Z5" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowOnboard(false)} className="px-3 py-2 rounded bg-slate-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-green-600 text-white">Complete KYC</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------- Small UI helpers ----------
function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-slate-400 mt-2">{subtitle}</div>
    </div>
  );
}
