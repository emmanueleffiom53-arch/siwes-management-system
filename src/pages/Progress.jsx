import { Stat } from '../components/UI.jsx'

function formatDate(date) {
  if (!date) return 'Not provided'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function profileValue(value) {
  return value?.trim() || 'Not provided'
}

export default function Progress({ profile, activities, approved, pending, total, progress }) {
  const orderedActivities = [...activities].sort((first, second) => first.date.localeCompare(second.date))
  const rejected = total - approved - pending
  const activityDates = orderedActivities.map((item) => item.date).filter(Boolean)
  const recordedFrom = activityDates.length ? formatDate(activityDates[0]) : 'No activities recorded'
  const recordedTo = activityDates.length ? formatDate(activityDates.at(-1)) : 'No activities recorded'
  const activitySummary = total
    ? `${profile.fullName} completed ${total} recorded ${total === 1 ? 'activity' : 'activities'} during the SIWES placement at ${profileValue(profile.organization)}. Entries cover ${recordedFrom} to ${recordedTo}. ${approved} ${approved === 1 ? 'activity has' : 'activities have'} been approved, ${pending} ${pending === 1 ? 'is' : 'are'} awaiting review${rejected ? `, and ${rejected} ${rejected === 1 ? 'was' : 'were'} rejected` : ''}.`
    : `${profile.fullName} has not recorded any activities for this SIWES placement yet.`

  return <div className="content report-page">
    <div className="page-intro report-toolbar">
      <div><p>Generated from the student profile and saved activity log.</p><h2>SIWES completion report</h2></div>
      <button className="button button-dark" onClick={() => window.print()}>Print report <span>→</span></button>
    </div>
    <div className="stats progress-cards report-stats">
      <Stat value={total} label="Activities recorded" />
      <Stat value={approved} label="Approved" tone="green" />
      <Stat value={pending} label="Awaiting review" tone="orange" />
      <div className="stat"><strong>{progress}%</strong><span>Approval rate</span></div>
    </div>
    <article className="report-document">
      <header className="report-heading">
        <div className="report-brand"><span className="brand-mark">S</span><span>SIWES TRACKER</span></div>
        <p>STUDENT INDUSTRIAL WORK EXPERIENCE SCHEME</p>
        <h1>Training Activity Report</h1>
        <span>Generated {formatDate(new Date().toISOString().slice(0, 10))}</span>
      </header>

      <section className="report-section">
        <h2>Student and placement information</h2>
        <dl className="report-details">
          <div><dt>Student name</dt><dd>{profileValue(profile.fullName)}</dd></div>
          <div><dt>Email</dt><dd>{profileValue(profile.email)}</dd></div>
          <div><dt>Phone</dt><dd>{profileValue(profile.phone)}</dd></div>
          <div><dt>Institution</dt><dd>{profileValue(profile.institution)}</dd></div>
          <div><dt>Department</dt><dd>{profileValue(profile.department)}</dd></div>
          <div><dt>Host organization</dt><dd>{profileValue(profile.organization)}</dd></div>
          <div><dt>Industry supervisor</dt><dd>{profileValue(profile.supervisor)}</dd></div>
          <div><dt>Training period</dt><dd>{formatDate(profile.startDate)} – {formatDate(profile.endDate)}</dd></div>
        </dl>
      </section>

      <section className="report-section">
        <h2>Placement summary</h2>
        <p className="report-summary">{activitySummary}</p>
        <p className="report-period"><strong>Activity record period:</strong> {recordedFrom} – {recordedTo}</p>
      </section>

      <section className="report-section report-activity-section">
        <h2>Recorded activities</h2>
        {orderedActivities.length ? <table className="report-activity-table">
          <thead><tr><th>Date</th><th>Activity and learning summary</th><th>Review status</th></tr></thead>
          <tbody>{orderedActivities.map((activity) => <tr key={activity.id}>
            <td>{formatDate(activity.date)}</td>
            <td><strong>{activity.title}</strong><p>{activity.description}</p></td>
            <td>{activity.status}</td>
          </tr>)}</tbody>
        </table> : <p className="report-summary">No activity entries have been submitted.</p>}
      </section>

      <section className="report-section report-outcome">
        <h2>Completion record</h2>
        <p>This report is an automatically compiled summary of the student information and activity entries saved in SIWES Tracker as of the date shown above.</p>
        <div className="report-signatures"><div><span />Student signature and date</div><div><span />Industry supervisor signature and date</div></div>
      </section>
      <footer className="report-footer">SIWES Tracker · Student training record · {profileValue(profile.organization)}</footer>
    </article>
  </div>
}
