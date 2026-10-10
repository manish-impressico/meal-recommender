'use client';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { useRouter } from 'next/navigation';
import { exportBackup, importBackup, resetAll, run } from '@/data/store';
import { Loading, PageHeader } from '@/ui';
import { useHousehold } from '../useHousehold';

export function SettingsView() {
  const { data } = useHousehold();
  const router = useRouter();
  if (!data) return <Loading />;
  const s = data.settings;
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' }));
    a.download = `meal-recommender-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const upload = async (f?: File) => { if (f && !importBackup(await f.text())) alert('That file is not a valid backup.'); };
  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: 640 }}>
      <PageHeader eyebrow="Settings" title="Settings and backup" />
      <div className="mr-card d-flex flex-column gap-2">
        <div className="fw-bold">Your data lives only in this browser</div>
        <div className="small text-secondary">Export a backup so members, plans and feedback survive if browser data is cleared.</div>
        <div className="d-flex gap-2"><Button onClick={download}>Export backup</Button><Form.Label className="btn btn-outline-primary m-0">Import backup<input type="file" accept="application/json" hidden onChange={(e) => upload(e.target.files?.[0])} /></Form.Label></div>
      </div>
      <div className="mr-card d-flex flex-column gap-3">
        <div className="fw-bold">Planning</div>
        <Form.Check type="switch" id="ai" label="Use AI to rank and explain picks (off = rule-based picks, no API calls)" checked={s.aiEnabled} onChange={(e) => run({ type: 'updateSettings', patch: { aiEnabled: e.target.checked } })} />
        <Form.Check type="switch" id="norep" label="No repeats within a week" checked={s.noRepeatsInWeek} onChange={(e) => run({ type: 'updateSettings', patch: { noRepeatsInWeek: e.target.checked } })} />
        <Form.Group><Form.Label className="small text-secondary">Max prep time</Form.Label>
          <Form.Select value={s.maxPrepMinutes} onChange={(e) => run({ type: 'updateSettings', patch: { maxPrepMinutes: Number(e.target.value) } })}>{[30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</Form.Select></Form.Group>
        <Form.Group><Form.Label className="small text-secondary">Week starts on</Form.Label>
          <Form.Select value={s.weekStartsOn} onChange={(e) => run({ type: 'updateSettings', patch: { weekStartsOn: Number(e.target.value) } })}><option value={1}>Monday</option><option value={0}>Sunday</option><option value={6}>Saturday</option></Form.Select></Form.Group>
      </div>
      <div className="mr-card d-flex align-items-center justify-content-between gap-2">
        <div><div className="fw-bold text-danger">Clear all data</div><div className="small text-secondary">Removes members, plans and feedback from this browser.</div></div>
        <Button variant="outline-danger" onClick={() => { if (confirm('Clear everything?')) { resetAll(); router.replace('/onboarding'); } }}>Clear</Button>
      </div>
    </div>
  );
}
