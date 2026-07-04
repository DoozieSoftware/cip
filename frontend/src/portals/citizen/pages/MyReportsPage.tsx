import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { EmptyState } from '../../moderator/design';

export default function MyReportsPage(): JSX.Element {
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My reports</h1>
          <p className="text-sm text-slate-600">Everything you've reported. Tap a card for the full timeline.</p>
        </div>
        <Link
          to="/citizen/submit"
          className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + New
        </Link>
      </header>

      <EmptyState
        title="Your report list shows up here"
        description="After you submit, the report will appear with live status updates from the department. Check the Updates tab for the latest notification."
        action={
          <Link
            to="/citizen/submit"
            className="mt-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Report an issue
          </Link>
        }
      />
    </div>
  );
}
