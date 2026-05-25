import React, { useState, useEffect, useMemo } from 'react';
import MetricsStrip from './components/MetricsStrip.jsx';
import CostChart from './components/CostChart.jsx';
import SessionsTable from './components/SessionsTable.jsx';
import SessionDetail from './components/SessionDetail.jsx';

const FILTER_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null },
];

function filterByDays(sessions, days) {
  if (!days) return sessions;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return sessions.filter(s => (s.started_at || '') >= cutoff);
}

export default function App() {
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [filterDays, setFilterDays] = useState(30);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => {
        setAllSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sessions = useMemo(() => filterByDays(allSessions, filterDays), [allSessions, filterDays]);

  const selectedSession = useMemo(
    () => allSessions.find(s => s.id === selectedId) ?? null,
    [allSessions, selectedId]
  );

  return (
    <div className="app">
      <header className="header">
        <span className="header__wordmark">tokentrace</span>
        <div className="header__controls">
          <div className="date-filter">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.label}
                className={`date-filter__btn ${filterDays === opt.days ? 'date-filter__btn--active' : ''}`}
                onClick={() => setFilterDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="main">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <MetricsStrip sessions={sessions} />
            <div className="body-columns">
              <div className="col-left">
                <CostChart sessions={sessions} />
                <div className="section-header">Sessions</div>
                <SessionsTable
                  sessions={sessions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <div className="col-right">
                <SessionDetail session={selectedSession} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
