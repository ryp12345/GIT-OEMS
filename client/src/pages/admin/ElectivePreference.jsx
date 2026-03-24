import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Notification from '../../components/common/Notification';
import {
  getInstances,
  getPreferenceStatisticsDetails,
  resetInstanceAllocations,
  downloadInstanceAllocations
} from '../../api/instance.api';

function formatGrade(value) {
	if (value == null || Number.isNaN(Number(value))) return '-';
	return Number(value).toFixed(2);
}

function toCsvCell(value) {
	return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function StatisticsChartModal({ row, onClose }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!row || !canvasRef.current) return undefined;

    // Dynamic labels from row.chartLabels or fallback to 1-9
    const labels = Array.isArray(row.chartLabels) && row.chartLabels.length > 0
      ? row.chartLabels
      : Array.from({ length: 9 }, (_, i) => `Final Preference ${i + 1}`);

    // Dynamic color palette
    const fallbackColors = [
      'rgba(59, 130, 246, 0.85)',
      'rgba(16, 185, 129, 0.85)',
      'rgba(245, 158, 11, 0.85)',
      'rgba(239, 68, 68, 0.85)',
      'rgba(99, 102, 241, 0.85)',
      'rgba(210, 214, 222, 0.85)',
      'rgba(0, 166, 90, 0.85)',
      'rgba(221, 75, 57, 0.85)',
      'rgba(255, 193, 7, 0.85)'
    ];

    // Datasets: each grade range is a series
    const datasets = (Array.isArray(row.chartData) ? row.chartData : []).map((series, index) => ({
      label: series.label || `Grade Range ${index + 1}`,
      data: Array.isArray(series.data) ? series.data.map((n) => Number(n || 0)) : Array(labels.length).fill(0),
      backgroundColor: series.backgroundColor || fallbackColors[index % fallbackColors.length],
      borderRadius: 8,
      borderSkipped: false,
      maxBarThickness: 34
    }));

    // Plugin to show stack totals above bars (match PHP: radius 18, border 3, font 14px)
    const showStackTotals = {
      id: 'showStackTotals',
      afterDatasetsDraw(chart) {
        const { ctx, data, scales: { x, y } } = chart;
        data.labels.forEach((label, i) => {
          let sum = 0;
          data.datasets.forEach(ds => {
            sum += ds.data[i] || 0;
          });
          const xPos = x.getPixelForValue(i);
          const yPos = y.getPixelForValue(sum) - 18;
          const radius = 18;
          ctx.save();
          ctx.beginPath();
          ctx.arc(xPos, yPos, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#FF4D00';
          ctx.stroke();
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = '#FF4D00';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sum, xPos, yPos);
          ctx.restore();
        });
      }
    };

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 12,
            cornerRadius: 10
          },
          datalabels: {
            display: function(context) {
              // Only show label if value is not zero
              return context.dataset.data[context.dataIndex] !== 0;
            },
            anchor: 'center',
            align: 'center',
            color: '#000',
            font: {
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            },
            title: {
              display: true,
              text: 'Preferences',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            ticks: {
              color: '#475569'
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Students',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            ticks: {
              precision: 0,
              color: '#475569'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.25)',
              borderDash: [5, 5]
            }
          }
        }
      },
      plugins: [ChartDataLabels, showStackTotals]
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [row]);

  if (!row) return null;

  const seriesCount = Array.isArray(row.chartData) ? row.chartData.length : 0;
  const totalAllocations = Array.isArray(row.chartData)
    ? row.chartData.reduce(
      (sum, series) => sum + (Array.isArray(series.data) ? series.data.reduce((s, n) => s + Number(n || 0), 0) : 0),
      0
    )
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-700 to-sky-600 px-6 py-4 text-white">
          <div>
            <h3 className="text-base font-semibold sm:text-lg">
              View Statistics of {row.coursename} - {row.coursecode}
            </h3>
            <p className="text-xs text-blue-100">Distribution by final preference across grade ranges</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Grade Series</p>
            <p className="text-lg font-semibold text-slate-800">{seriesCount}</p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Chart Allocations</p>
            <p className="text-lg font-semibold text-slate-800">{totalAllocations}</p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Course Allocation Status</p>
            <p className="text-lg font-semibold text-slate-800">{row.allocation_status || 'Pending'}</p>
          </div>
        </div>

        <div className="h-[420px] p-6">
          {seriesCount > 0 ? (
            <canvas ref={canvasRef} />
          ) : (
            <p className="text-sm text-gray-600">No allocation chart data available for this course.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ElectivePreferencePage() {
  const token = localStorage.getItem('token');
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('#');
  const [rows, setRows] = useState([]);
  const [grandTotalAllocations, setGrandTotalAllocations] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [activeChartRow, setActiveChartRow] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  // Find all unique preferences in the data for dynamic columns
  function getAllPreferences(rows) {
    const prefs = new Set();
    rows.forEach(row => {
      if (Array.isArray(row.preferences)) {
        row.preferences.forEach(p => prefs.add(p.prefIndex));
      } else {
        // fallback for old API shape
        [1,2].forEach(i => prefs.add(i));
      }
    });
    return Array.from(prefs).sort((a, b) => a - b);
  }

  function applyPreferenceDetailsResponse(payload) {
    let nextRows = [];
    if (Array.isArray(payload)) {
      nextRows = payload;
    } else if (Array.isArray(payload?.rows)) {
      nextRows = payload.rows;
    }
    setRows(nextRows);
    setGrandTotalAllocations(nextRows.reduce((sum, row) => sum + Number(row.total_allocations || 0), 0));
  }

  useEffect(() => {
    (async function loadInstances() {
      try {
        const res = await getInstances(token);
        const data = res?.data || [];
        setInstances(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Unable to load instances');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedInstance || selectedInstance === '#') {
      setRows([]);
      setGrandTotalAllocations(0);
      setActiveChartRow(null);
      return;
    }

    (async function loadDetails() {
      try {
        setIsLoading(true);
        setError('');
        const res = await getPreferenceStatisticsDetails(selectedInstance, token);
        applyPreferenceDetailsResponse(res?.data);
      } catch (err) {
        setError(err?.response?.data?.error || 'Unable to load elective preference details');
        setRows([]);
        setGrandTotalAllocations(0);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedInstance]);

  function showNotification(message, type = 'success') {
    setNotification({ show: true, message, type });
  }

  async function handleResetAllocations() {
    if (!selectedInstance || selectedInstance === '#') return;

    const confirmed = window.confirm('Are you sure you want to reset all allocations? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setIsResetting(true);
      setError('');
      await resetInstanceAllocations(selectedInstance, token);
      showNotification('Allocations reset successfully.', 'success');

      const res = await getPreferenceStatisticsDetails(selectedInstance, token);
      applyPreferenceDetailsResponse(res?.data);
      setActiveChartRow(null);
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to reset allocations.';
      setError(message);
      showNotification(message, 'error');
    } finally {
      setIsResetting(false);
    }
  }

  async function downloadExcel() {
    if (!selectedInstance || selectedInstance === '#') {
      showNotification('Please select an instance', 'error');
      return;
    }
    try {
      const res = await downloadInstanceAllocations(selectedInstance, token);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `student_allocations_${selectedInstance}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Excel downloaded successfully.', 'success');
    } catch (err) {
      showNotification('Failed to download Excel.', 'error');
    }
  }

  const hasSelectedInstance = selectedInstance && selectedInstance !== '#';
  // Dynamic preferences for table columns
  const allPreferences = useMemo(() => getAllPreferences(rows), [rows]);

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Notification
              show={notification.show}
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification({ show: false, message: '', type: 'info' })}
            />

            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-gray-900">Elective Preferences</h1>
              <p className="text-sm text-gray-600">Open Elective Management System.</p>
            </div>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full max-w-md">
                <label className="block text-sm font-semibold text-blue-700">Elective Instance</label>
                <select
                  value={selectedInstance}
                  onChange={(event) => setSelectedInstance(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm"
                >
                  <option value="#">Select Elective Instance</option>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {`${instance.instancename} - ${instance.academic_year} (Sem ${instance.semester})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAllocations}
                  disabled={selectedInstance === '#' || isResetting}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Reset Allocations'}
                </button>
                <button
                  type="button"
                  onClick={downloadExcel}
                  disabled={selectedInstance === '#'}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  Download
                </button>
              </div>
            </div>

            {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <div className="overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border px-4 py-3 text-left text-xs uppercase" rowSpan={2}>Sl.No</th>
                      <th className="border px-4 py-3 text-left text-xs uppercase" rowSpan={2}>Course Name</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" colSpan={allPreferences.length * 4}>Preferences</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Div</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Min</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Max</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Allocations</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Status</th>
                      <th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Stats</th>
                    </tr>
                    <tr className="bg-blue-600 text-white">
                      {allPreferences.map((pref) => [
                        <th key={`p${pref}_count`} className="border px-3 py-2 text-center text-xs font-semibold">{pref}</th>,
                        <th key={`p${pref}_min`} className="border px-3 py-2 text-center text-xs">Min</th>,
                        <th key={`p${pref}_median`} className="border px-3 py-2 text-center text-xs">Median</th>,
                        <th key={`p${pref}_max`} className="border px-3 py-2 text-center text-xs">Max</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={allPreferences.length * 4 + 7} className="px-6 py-12 text-center text-gray-500">Loading...</td>
                      </tr>
                    ) : rows.length === 0 && !hasSelectedInstance ? (
                      <tr>
                        <td colSpan={allPreferences.length * 4 + 7} className="px-6 py-12 text-center text-gray-500">
                          Please select an instance to view preferences.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => {
                        const status = String(row.allocation_status || 'Pending').toLowerCase();
                        const statusRowClass = status === 'rejected'
                          ? 'bg-red-100'
                          : status === 'allocated'
                            ? 'bg-emerald-100'
                            : 'bg-gray-100';

                        // Map preferences for this row by index
                        const prefMap = {};
                        if (Array.isArray(row.preferences)) {
                          row.preferences.forEach(p => {
                            prefMap[p.prefIndex] = p;
                          });
                        }

                        return (
                          <tr key={`${row.coursecode}-${index}`} className={`${statusRowClass} border-b border-gray-200`}>
                            <td className="border px-3 py-2 text-sm">{index + 1}</td>
                            <td className="border px-3 py-2 text-sm">{row.coursename} ({row.coursecode})</td>
                            {allPreferences.map((pref) => {
                              const p = prefMap[pref] || {};
                              return [
                                <td key={`p${pref}_count`} className="border border-l-2 border-r-2 border-blue-600 px-3 py-2 text-center text-sm font-bold">{p.count ?? ''}</td>,
                                <td key={`p${pref}_min`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.min_grade)}</td>,
                                <td key={`p${pref}_median`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.median_grade)}</td>,
                                <td key={`p${pref}_max`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.max_grade)}</td>
                              ];
                            })}
                            <td className="border px-3 py-2 text-center text-sm">{row.division}</td>
                            <td className="border px-3 py-2 text-center text-sm">{row.min_intake}</td>
                            <td className="border px-3 py-2 text-center text-sm">{row.max_intake}</td>
                            <td className="border border-l-2 border-r-2 border-blue-600 px-3 py-2 text-center text-sm font-bold">{row.total_allocations}</td>
                            <td className="border px-3 py-2 text-center text-sm font-bold">{row.allocation_status}</td>
                            <td className="border px-3 py-2 text-center text-sm">
                              {Number(row.total_allocations) > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveChartRow(row)}
                                  aria-label="View statistics"
                                  title="View statistics"
                                  className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path d="M10 3C5.454 3 1.68 5.943.458 10c1.221 4.057 4.996 7 9.542 7s8.32-2.943 9.542-7c-1.221-4.057-4.996-7-9.542-7zm0 11.5A4.5 4.5 0 1110 5.5a4.5 4.5 0 010 9zm0-7A2.5 2.5 0 1010 13a2.5 2.5 0 000-5z" />
                                  </svg>
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {hasSelectedInstance && !isLoading ? (
                      <tr className="bg-gray-200">
                        <td colSpan={allPreferences.length * 4 + 3} className="border px-3 py-2 text-sm font-bold">Grand Total Allocations</td>
                        <td className="border border-l-2 border-r-2 border-blue-600 px-3 py-2 text-center text-sm font-bold">{grandTotalAllocations}</td>
                        <td className="border px-3 py-2" />
                        <td className="border px-3 py-2" />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {activeChartRow ? <StatisticsChartModal row={activeChartRow} onClose={() => setActiveChartRow(null)} /> : null}
    </div>
  );
}
