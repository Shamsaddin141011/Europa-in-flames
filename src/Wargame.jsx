import React, { useState, useEffect } from 'react';
import { Crown, Sword, Scroll, Coins, Shield, Send, RefreshCw, Flame } from 'lucide-react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import provincesData from './provinces-topo.json';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const FACTION_COLORS = {
  France:  { bg: '#1e3a8a', accent: '#dc2626', emblem: '⚜' },
  Britain: { bg: '#7f1d1d', accent: '#fbbf24', emblem: '🦁' },
  Russia:  { bg: '#064e3b', accent: '#fbbf24', emblem: '☦' },
  Prussia: { bg: '#1c1917', accent: '#e7e5e4', emblem: '🦅' },
  Austria: { bg: '#78350f', accent: '#fef3c7', emblem: '⚔' },
  Spain:   { bg: '#9f1239', accent: '#fbbf24', emblem: '⚜' },
  Ottoman: { bg: '#14532d', accent: '#dc2626', emblem: '☪' },
  Naples:  { bg: '#581c87', accent: '#fbbf24', emblem: '♕' },
};

const FACTION_MAP_FILL = {
  France:  '#3b82f6',
  Britain: '#ef4444',
  Russia:  '#22c55e',
  Prussia: '#a8a29e',
  Austria: '#f59e0b',
  Spain:   '#a855f7',
  Ottoman: '#06b6d4',
  Naples:  '#ec4899',
};


// ISO 3166-1 alpha-3 → alpha-2 (Natural Earth admin-1 uses adm0_a3)
const ALPHA3_TO_ALPHA2 = {
  AND:'AD', ALB:'AL', ARM:'AM', AUT:'AT', AZE:'AZ', BIH:'BA', BEL:'BE', BGR:'BG',
  BLR:'BY', CHE:'CH', CZE:'CZ', DEU:'DE', DNK:'DK', DZA:'DZ', EST:'EE', EGY:'EG',
  ESP:'ES', FIN:'FI', FRA:'FR', GBR:'GB', GEO:'GE', GRC:'GR', HRV:'HR', HUN:'HU',
  IRL:'IE', ISR:'IL', IRQ:'IQ', ITA:'IT', JOR:'JO', KWT:'KW', KAZ:'KZ', LBN:'LB',
  LTU:'LT', LUX:'LU', LVA:'LV', LBY:'LY', MCO:'MC', MDA:'MD', MKD:'MK', MLT:'MT',
  NLD:'NL', NOR:'NO', OMN:'OM', POL:'PL', PRT:'PT', ROU:'RO', SRB:'RS', RUS:'RU',
  SAU:'SA', SWE:'SE', SVN:'SI', SVK:'SK', SMR:'SM', SYR:'SY', TUN:'TN', TUR:'TR',
  UKR:'UA', XKX:'XK', YEM:'YE',
};

const INITIAL_MAP_CONTROL = {
  // France and satellites
  FR:'France', NL:'France', BE:'France', LU:'France', CH:'France', MC:'France',
  // Britain
  GB:'Britain', IE:'Britain', MT:'Britain', PT:'Britain',
  // Russia
  RU:'Russia', EE:'Russia', LV:'Russia', LT:'Russia', BY:'Russia', UA:'Russia',
  MD:'Russia', AM:'Russia', GE:'Russia', AZ:'Russia',
  // Prussia
  DE:'Prussia', PL:'Prussia', DK:'Prussia', SE:'Prussia', NO:'Prussia', FI:'Prussia',
  // Austria
  AT:'Austria', CZ:'Austria', SK:'Austria', HU:'Austria', SI:'Austria', HR:'Austria',
  // Spain
  ES:'Spain', AD:'Spain',
  // Ottoman Empire
  TR:'Ottoman', GR:'Ottoman', BG:'Ottoman', RS:'Ottoman', BA:'Ottoman', AL:'Ottoman',
  MK:'Ottoman', RO:'Ottoman', SY:'Ottoman', LB:'Ottoman', IL:'Ottoman', JO:'Ottoman',
  IQ:'Ottoman', SA:'Ottoman', YE:'Ottoman', EG:'Ottoman', LY:'Ottoman', TN:'Ottoman', DZ:'Ottoman',
  // Kingdom of Naples
  IT:'Naples', SM:'Naples',
};

const INITIAL_STATE = {
  factions: {
    France:  { player: null, armies: 100, territories: ['Paris','Lyon','Marseille'],              treasury: 1000, morale: 95 },
    Britain: { player: null, armies: 70,  territories: ['London','Edinburgh','Gibraltar'],         treasury: 1500, morale: 85 },
    Russia:  { player: null, armies: 120, territories: ['Moscow','St Petersburg','Warsaw'],        treasury: 600,  morale: 70 },
    Prussia: { player: null, armies: 60,  territories: ['Berlin','Konigsberg'],                    treasury: 500,  morale: 75 },
    Austria: { player: null, armies: 80,  territories: ['Vienna','Prague','Budapest'],             treasury: 700,  morale: 65 },
    Spain:   { player: null, armies: 50,  territories: ['Madrid','Barcelona'],                     treasury: 400,  morale: 50 },
    Ottoman: { player: null, armies: 75,  territories: ['Constantinople','Cairo','Damascus'],      treasury: 600,  morale: 60 },
    Naples:  { player: null, armies: 30,  territories: ['Naples','Sicily'],                        treasury: 300,  morale: 55 },
  },
  year: 1805,
  season: 'Spring',
  mapControl: INITIAL_MAP_CONTROL,
};

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Wargame() {
  const [game, setGame] = useState(null);
  const [orders, setOrders] = useState([]);
  const [myFaction, setMyFaction] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('myFaction') || '' : '');
  const [myName, setMyName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('myName') || '' : '');
  const [claimName, setClaimName] = useState('');
  const [orderText, setOrderText] = useState('');
  const [refMode, setRefMode] = useState(false);
  const [refPasswordInput, setRefPasswordInput] = useState('');
  const [refPasswordMode, setRefPasswordMode] = useState(false);
  const [pasteResult, setPasteResult] = useState('');
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredGeo, setHoveredGeo] = useState(null);

  const loadGame = async () => {
    try {
      let [g, o] = await Promise.all([
        sb('game?id=eq.1&select=*'),
        sb('orders?select=*&order=submitted_at.desc'),
      ]);
      if (!g || g.length === 0) {
        const created = await sb('game', {
          method: 'POST',
          body: JSON.stringify({ id: 1, turn: 1, state: INITIAL_STATE, narrative: '' }),
        });
        g = created;
      }
      setGame(g[0]);
      setOrders(o);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGame();
    const interval = setInterval(loadGame, 5000);
    return () => clearInterval(interval);
  }, []);


  // Clear stale localStorage faction if game was reset or faction was taken
  useEffect(() => {
    if (game && myFaction && myName) {
      const fd = game.state.factions[myFaction];
      if (!fd || fd.player !== myName) {
        localStorage.removeItem('myFaction');
        localStorage.removeItem('myName');
        setMyFaction('');
        setMyName('');
      }
    }
  }, [game]);

  const currentOrders = orders.filter(o => o.turn === game?.turn);
  const myCurrentOrder = currentOrders.find(o => o.faction === myFaction);

  const claimFaction = async (factionName) => {
    if (!claimName.trim()) { setStatus('Enter your name first'); return; }
    if (game.state.factions[factionName].player) { setStatus('That faction is already claimed'); return; }
    try {
      const newState = {
        ...game.state,
        factions: { ...game.state.factions, [factionName]: { ...game.state.factions[factionName], player: claimName } },
      };
      await sb('game?id=eq.1', { method: 'PATCH', body: JSON.stringify({ state: newState }) });
      localStorage.setItem('myFaction', factionName);
      localStorage.setItem('myName', claimName);
      setMyFaction(factionName);
      setMyName(claimName);
      setStatus(`You are now ruling ${factionName}`);
      loadGame();
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const releaseFaction = () => {
    if (!confirm('Release your faction? Anyone can claim it after.')) return;
    const newState = {
      ...game.state,
      factions: { ...game.state.factions, [myFaction]: { ...game.state.factions[myFaction], player: null } },
    };
    sb('game?id=eq.1', { method: 'PATCH', body: JSON.stringify({ state: newState }) }).then(() => {
      localStorage.removeItem('myFaction');
      localStorage.removeItem('myName');
      setMyFaction('');
      setMyName('');
      loadGame();
    });
  };

  const submitOrder = async () => {
    if (!myFaction || !orderText.trim()) { setStatus('Write your orders first'); return; }
    if (myCurrentOrder) { setStatus('Already submitted. Withdraw to resubmit.'); return; }
    try {
      await sb('orders', {
        method: 'POST',
        body: JSON.stringify({ turn: game.turn, faction: myFaction, player_name: myName, order_text: orderText }),
      });
      setStatus(`Orders sealed for ${myFaction}`);
      setOrderText('');
      loadGame();
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const withdrawOrder = async (orderId) => {
    try {
      await sb(`orders?id=eq.${orderId}`, { method: 'DELETE' });
      setStatus('Orders withdrawn');
      loadGame();
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const voteRestart = async () => {
    const currentVotes = (game.state.restartVotes || []);
    const newVotes = currentVotes.includes(myFaction)
      ? currentVotes.filter(f => f !== myFaction)
      : [...currentVotes, myFaction];
    const activeClaimed = Object.entries(game.state.factions)
      .filter(([, d]) => d.player).map(([name]) => name);
    const activeVotes = newVotes.filter(f => activeClaimed.includes(f));
    const majorityNeeded = Math.floor(activeClaimed.length / 2) + 1;
    if (activeVotes.length >= majorityNeeded && activeClaimed.length > 0) {
      try {
        await sb('orders?turn=gte.1', { method: 'DELETE' });
        await sb('game?id=eq.1', {
          method: 'PATCH',
          body: JSON.stringify({ turn: 1, state: INITIAL_STATE, narrative: '' }),
        });
        localStorage.removeItem('myFaction');
        localStorage.removeItem('myName');
        setMyFaction('');
        setMyName('');
        loadGame();
      } catch (e) { setStatus('Error restarting: ' + e.message); }
    } else {
      try {
        await sb('game?id=eq.1', {
          method: 'PATCH',
          body: JSON.stringify({ state: { ...game.state, restartVotes: activeVotes } }),
        });
        loadGame();
      } catch (e) { setStatus('Error: ' + e.message); }
    }
  };

  const unlockRef = () => {
    if (refPasswordInput === 'Orud_iw') {
      setRefMode(true);
      setRefPasswordMode(false);
      setRefPasswordInput('');
    } else {
      setStatus('Wrong password');
    }
  };

  const copyPrompt = () => {
    if (currentOrders.length === 0) { setStatus('No orders to copy'); return; }
    const orderLines = currentOrders.map(o => `${o.faction} — ${o.player_name}: ${o.order_text}`).join('\n\n');
    const stateStr = JSON.stringify(game.state, null, 2);
    const text = `You are the impartial referee of a Napoleonic Wars alt-history wargame. Resolve Turn ${game.turn} (${game.state.season} ${game.state.year}).

Game state:
${stateStr}

Player orders:
${orderLines}

Apply historical realism — geography, supply lines, army size, treasury, morale, diplomacy, and random misfortune where plausible. Be strictly impartial.

Return ONLY valid JSON in this exact format:
{
  "narrative": "3-5 paragraph dramatic chronicle of what happened this turn",
  "updated_state": { "factions": {}, "year": 0, "season": "" },
  "map_control": { "ISO_CODE": "FactionName" }
}

For map_control: use ISO 3166-1 alpha-2 codes. Only include countries that CHANGED HANDS this turn — current control is in game state under mapControl. Factions: France, Britain, Russia, Prussia, Austria, Spain, Ottoman, Naples. Example: if France captures Austria this turn, include "AT": "France".

Advance the season (Spring→Summer→Autumn→Winter→next year Spring). Update armies, territories, treasury, morale. Output nothing except the JSON.`;
    navigator.clipboard.writeText(text);
    setStatus('Prompt copied — paste into Claude.ai');
  };

  const applyResult = async () => {
    if (!pasteResult.trim()) { setStatus('Paste the JSON result first'); return; }
    setApplying(true);
    try {
      const clean = pasteResult.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      const preservedFactions = {};
      Object.entries(result.updated_state.factions).forEach(([name, data]) => {
        preservedFactions[name] = { ...data, player: game.state.factions[name]?.player ?? null };
      });
      const existingControl = game.state.mapControl || INITIAL_MAP_CONTROL;
      const newMapControl = result.map_control
        ? { ...existingControl, ...result.map_control }
        : existingControl;
      await sb('game?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({
          turn: game.turn + 1,
          state: { ...result.updated_state, factions: preservedFactions, mapControl: newMapControl },
          narrative: result.narrative,
          updated_at: new Date().toISOString(),
        }),
      });
      setPasteResult('');
      setRefMode(false);
      setStatus('Turn advanced to ' + (game.turn + 1));
      loadGame();
    } catch (e) {
      setStatus('Invalid JSON: ' + e.message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1410', color: '#f5e6c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center' }}>
          <Crown size={64} style={{ margin: '0 auto', opacity: 0.6 }} />
          <p style={{ marginTop: 16, letterSpacing: 4, fontSize: 14, opacity: 0.7 }}>LOADING THE CHRONICLE...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1410', color: '#f5e6c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <Crown size={64} style={{ margin: '0 auto 16px', opacity: 0.6 }} />
          <h2 style={{ letterSpacing: 4, color: '#d4af37' }}>CHRONICLE UNREACHABLE</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.8, marginTop: 16 }}>
            Cannot connect to the database. Check Supabase env vars and that the tables exist.
          </p>
          <p style={{ fontSize: 12, color: '#dc2626', marginTop: 16 }}>{status}</p>
          <button onClick={loadGame} style={{ marginTop: 16, padding: '10px 24px', background: '#8b6914', color: '#1a1410', border: 'none', cursor: 'pointer', letterSpacing: 3, fontSize: 12, fontWeight: 'bold', fontFamily: 'inherit' }}>RETRY</button>
        </div>
      </div>
    );
  }

  const claimedCount = Object.values(game.state.factions).filter(f => f.player).length;
  const restartVotes = (game.state.restartVotes || []).filter(f => game.state.factions[f]?.player);
  const majorityNeeded = Math.floor(claimedCount / 2) + 1;
  const hasVotedRestart = restartVotes.includes(myFaction);
  const mapControl = game.state.mapControl || INITIAL_MAP_CONTROL;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1410 0%, #2d1f15 50%, #1a1410 100%)', color: '#f5e6c8', fontFamily: 'Georgia, "Times New Roman", serif', padding: '24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, borderBottom: '2px solid #8b6914', paddingBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
            <Crown size={40} color="#d4af37" />
            <h1 style={{ fontSize: 48, margin: 0, letterSpacing: 6, fontWeight: 'normal', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>EUROPA IN FLAMES</h1>
            <Crown size={40} color="#d4af37" />
          </div>
          <p style={{ letterSpacing: 8, fontSize: 12, opacity: 0.7, margin: 0 }}>A CHRONICLE OF THE NAPOLEONIC WARS</p>
          <div style={{ marginTop: 16, display: 'inline-flex', gap: 24, padding: '8px 32px', border: '1px solid #8b6914', borderRadius: 2, background: 'rgba(0,0,0,0.3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 14 }}><Scroll size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />TURN {game.turn}</span>
            <span style={{ fontSize: 14 }}>{game.state.season} of {game.state.year}</span>
            <span style={{ fontSize: 14, color: currentOrders.length > 0 ? '#90ee90' : '#d4af37' }}>{currentOrders.length}/{claimedCount || 8} ORDERS</span>
          </div>
        </div>

        {/* Narrative */}
        {game.narrative && (
          <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #8b6914', padding: 24, marginBottom: 32, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: 24, background: '#1a1410', padding: '0 12px', fontSize: 11, letterSpacing: 4, color: '#d4af37' }}>
              ⚔ CHRONICLE OF TURN {game.turn - 1} ⚔
            </div>
            <p style={{ lineHeight: 1.8, fontSize: 15, whiteSpace: 'pre-wrap', margin: 0, fontStyle: 'italic' }}>{game.narrative}</p>
          </div>
        )}

        {/* Map */}
        <div style={{ marginBottom: 32, border: '1px solid #8b6914', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid #8b6914', fontSize: 11, letterSpacing: 4, color: '#d4af37', textAlign: 'center' }}>
            ⚔ THE THEATRE OF WAR · {game.state.season.toUpperCase()} {game.state.year} ⚔
          </div>
          <div style={{ background: '#0a0806', lineHeight: 0 }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [20, 52], scale: 520 }}
              style={{ width: '100%', display: 'block' }}
              width={960}
              height={500}
            >
              <Geographies geography={provincesData}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const a2 = ALPHA3_TO_ALPHA2[geo.properties.adm0_a3];
                    const faction = a2 ? mapControl[a2] : undefined;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={faction ? FACTION_MAP_FILL[faction] : '#1e1a16'}
                        stroke="#0a0806"
                        strokeWidth={0.3}
                        onMouseEnter={() => setHoveredGeo({ name: geo.properties.name, country: geo.properties.admin, faction })}
                        onMouseLeave={() => setHoveredGeo(null)}
                        style={{
                          default: { outline: 'none', opacity: faction ? 0.9 : 0.5 },
                          hover:   { outline: 'none', opacity: 1, filter: 'brightness(1.3)' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
          {/* Hover info */}
          <div style={{ padding: '5px 16px', background: 'rgba(0,0,0,0.7)', borderTop: '1px solid #2a2420', fontSize: 12, letterSpacing: 1, minHeight: 26, lineHeight: '16px', color: hoveredGeo?.faction ? FACTION_MAP_FILL[hoveredGeo.faction] : '#555' }}>
            {hoveredGeo
              ? `${hoveredGeo.name}${hoveredGeo.country && hoveredGeo.country !== hoveredGeo.name ? `, ${hoveredGeo.country}` : ''} — ${hoveredGeo.faction ? hoveredGeo.faction.toUpperCase() : 'NEUTRAL'}`
              : 'Hover over a province for details'}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '10px 16px', background: 'rgba(0,0,0,0.6)', borderTop: '1px solid #2a2420' }}>
            {Object.entries(FACTION_MAP_FILL).map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 12, height: 12, background: color, flexShrink: 0 }} />
                <span style={{ color: '#c8b89a', letterSpacing: 1 }}>{FACTION_COLORS[name].emblem} {name.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Faction cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {Object.entries(game.state.factions).map(([name, data]) => {
            const colors = FACTION_COLORS[name];
            const hasOrdered = currentOrders.some(o => o.faction === name);
            const isMine = myFaction === name;
            const isClaimed = !!data.player;
            return (
              <div key={name} style={{ background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg}dd 100%)`, border: isMine ? `3px solid ${colors.accent}` : hasOrdered ? `2px solid ${colors.accent}` : '1px solid rgba(255,255,255,0.2)', padding: 16, borderRadius: 2, boxShadow: isMine ? `0 0 30px ${colors.accent}80` : hasOrdered ? `0 0 20px ${colors.accent}40` : '0 4px 12px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 20, letterSpacing: 2 }}><span style={{ marginRight: 8 }}>{colors.emblem}</span>{name.toUpperCase()}</h3>
                  {hasOrdered && <span style={{ fontSize: 10, color: colors.accent, letterSpacing: 2 }}>● ORDERED</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 10, letterSpacing: 1, minHeight: 14 }}>
                  {isClaimed ? `RULED BY ${data.player.toUpperCase()}${isMine ? ' (YOU)' : ''}` : 'UNCLAIMED'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div><Sword size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{data.armies}k troops</div>
                  <div><Coins size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{data.treasury}</div>
                  <div><Flame size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Morale {data.morale}</div>
                  <div><Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{data.territories.length} lands</div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 11, opacity: 0.8 }}>
                  {data.territories.join(' · ')}
                </div>
                {!isClaimed && !myFaction && (
                  <button onClick={() => claimFaction(name)} style={{ marginTop: 12, width: '100%', padding: '8px', background: colors.accent, color: colors.bg, border: 'none', cursor: 'pointer', letterSpacing: 2, fontSize: 11, fontWeight: 'bold', fontFamily: 'inherit' }}>⚔ CLAIM THIS THRONE ⚔</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Restart vote */}
        {(restartVotes.length > 0 || myFaction) && (
          <div style={{ marginBottom: 32, border: '1px solid #4a3728', borderRadius: 2, background: 'rgba(0,0,0,0.35)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <span style={{ fontSize: 11, letterSpacing: 3, color: '#a06040' }}>⚑ RESTART VOTE</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: restartVotes.length >= majorityNeeded ? '#ef4444' : '#c8b89a' }}>
                {restartVotes.length}/{claimedCount > 0 ? majorityNeeded : '?'} needed
              </span>
              {restartVotes.length > 0 && (
                <span style={{ marginLeft: 10, fontSize: 11, color: '#888' }}>
                  {restartVotes.map(f => `${FACTION_COLORS[f]?.emblem} ${f}`).join('  ')}
                </span>
              )}
            </div>
            {myFaction && (
              <button onClick={voteRestart} style={{ padding: '7px 18px', background: hasVotedRestart ? 'transparent' : '#7f1d1d', color: hasVotedRestart ? '#a06040' : '#fbbf24', border: `1px solid ${hasVotedRestart ? '#4a3728' : '#dc2626'}`, cursor: 'pointer', fontSize: 11, letterSpacing: 2, fontFamily: 'inherit', fontWeight: 'bold' }}>
                {hasVotedRestart ? 'WITHDRAW VOTE' : 'VOTE TO RESTART'}
              </button>
            )}
          </div>
        )}

        {/* Order input */}
        {!myFaction ? (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #8b6914', padding: 24, marginBottom: 32, borderRadius: 2, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px 0', letterSpacing: 4, fontSize: 18, color: '#d4af37' }}>⚜ ENTER THE CHRONICLE ⚜</h2>
            <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>{claimedCount} of 8 thrones claimed. Declare your name, then claim a faction above.</p>
            <input type="text" placeholder="Your name, sovereign..." value={claimName} onChange={e => setClaimName(e.target.value)}
              style={{ padding: 12, background: '#2d1f15', color: '#f5e6c8', border: '1px solid #8b6914', fontFamily: 'inherit', fontSize: 14, width: 300, textAlign: 'center' }} />
            {status && <p style={{ fontSize: 12, marginTop: 12, color: '#d4af37' }}>{status}</p>}
          </div>
        ) : (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${FACTION_COLORS[myFaction].accent}`, padding: 24, marginBottom: 32, borderRadius: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, letterSpacing: 4, fontSize: 18, color: FACTION_COLORS[myFaction].accent }}>{FACTION_COLORS[myFaction].emblem} ORDERS OF {myFaction.toUpperCase()}</h2>
              <button onClick={releaseFaction} style={{ padding: '4px 12px', background: 'transparent', color: '#888', border: '1px solid #555', cursor: 'pointer', fontSize: 10, letterSpacing: 2, fontFamily: 'inherit' }}>ABDICATE</button>
            </div>
            {myCurrentOrder ? (
              <div style={{ background: '#1a1410', padding: 16, border: '1px dashed #8b6914' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 11, letterSpacing: 2, color: '#d4af37' }}>SEALED ORDERS — TURN {game.turn}</p>
                <p style={{ margin: '0 0 12px 0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{myCurrentOrder.order_text}</p>
                <button onClick={() => withdrawOrder(myCurrentOrder.id)} style={{ padding: '6px 14px', background: 'transparent', color: '#aaa', border: '1px solid #555', cursor: 'pointer', fontSize: 11, letterSpacing: 2, fontFamily: 'inherit' }}>WITHDRAW & REWRITE</button>
              </div>
            ) : (
              <>
                <textarea value={orderText} onChange={e => setOrderText(e.target.value)}
                  placeholder="Issue your commands... March armies, lay siege, negotiate treaties, raise taxes, propose marriages, betray allies. Write freely."
                  rows={5}
                  style={{ width: '100%', padding: 12, background: '#2d1f15', color: '#f5e6c8', border: '1px solid #8b6914', fontFamily: 'inherit', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{status}</span>
                  <button onClick={submitOrder} style={{ padding: '12px 32px', background: FACTION_COLORS[myFaction].accent, color: FACTION_COLORS[myFaction].bg, border: 'none', cursor: 'pointer', letterSpacing: 3, fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit' }}>
                    <Send size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />SEAL & DISPATCH
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Referee panel */}
        <div style={{ background: 'rgba(139,69,19,0.1)', border: '1px dashed #8b6914', padding: 20, borderRadius: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, letterSpacing: 3, fontSize: 16, color: '#d4af37' }}>⚖ REFEREE PANEL</h3>
            {refMode ? (
              <button onClick={() => { setRefMode(false); setRefPasswordMode(false); }} style={{ padding: '6px 16px', background: 'transparent', color: '#d4af37', border: '1px solid #8b6914', cursor: 'pointer', fontSize: 11, letterSpacing: 2, fontFamily: 'inherit' }}>LOCK</button>
            ) : (
              <button onClick={() => setRefPasswordMode(v => !v)} style={{ padding: '6px 16px', background: 'transparent', color: '#d4af37', border: '1px solid #8b6914', cursor: 'pointer', fontSize: 11, letterSpacing: 2, fontFamily: 'inherit' }}>UNLOCK</button>
            )}
          </div>
          {!refMode && refPasswordMode && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input type="password" placeholder="Referee password..." value={refPasswordInput}
                onChange={e => setRefPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && unlockRef()}
                style={{ padding: '8px 12px', background: '#2d1f15', color: '#f5e6c8', border: '1px solid #8b6914', fontFamily: 'inherit', fontSize: 13, flex: 1 }} />
              <button onClick={unlockRef} style={{ padding: '8px 16px', background: '#8b6914', color: '#1a1410', border: 'none', cursor: 'pointer', letterSpacing: 2, fontSize: 11, fontWeight: 'bold', fontFamily: 'inherit' }}>ENTER</button>
            </div>
          )}
          {refMode && (
            <>
              <button onClick={copyPrompt} disabled={currentOrders.length === 0} style={{ padding: '12px 24px', background: '#8b6914', color: '#1a1410', border: 'none', cursor: currentOrders.length === 0 ? 'not-allowed' : 'pointer', letterSpacing: 3, fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit', marginBottom: 20, opacity: currentOrders.length === 0 ? 0.5 : 1 }}>
                <Scroll size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />COPY PROMPT
              </button>
              <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: 2, color: '#d4af37', opacity: 0.8 }}>PASTE JSON RESULT FROM CLAUDE</div>
              <textarea value={pasteResult} onChange={e => setPasteResult(e.target.value)}
                placeholder='Paste the {"narrative": ..., "updated_state": ..., "map_control": {...}} JSON here'
                rows={6}
                style={{ width: '100%', padding: 12, background: '#2d1f15', color: '#f5e6c8', border: '1px solid #8b6914', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, opacity: 0.7, color: status.includes('Invalid') ? '#dc2626' : '#d4af37' }}>{status}</span>
                <button onClick={applyResult} disabled={applying || !pasteResult.trim()} style={{ padding: '12px 28px', background: applying ? '#444' : '#dc2626', color: '#fff', border: 'none', cursor: applying || !pasteResult.trim() ? 'not-allowed' : 'pointer', letterSpacing: 3, fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit', opacity: !pasteResult.trim() ? 0.5 : 1 }}>
                  {applying
                    ? <RefreshCw size={14} style={{ display: 'inline', marginRight: 6, animation: 'spin 1s linear infinite' }} />
                    : <Sword size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />}
                  {applying ? 'APPLYING...' : `APPLY & ADVANCE TO TURN ${game.turn + 1}`}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, opacity: 0.5, letterSpacing: 3 }}>⚜ EUROPA IN FLAMES · 1805 ⚜</div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
