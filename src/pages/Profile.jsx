import { useState } from 'react'

const profileOptions = {
  institution: [
    'Abia State University', 'Ahmadu Bello University', 'Akwa Ibom State University', 'Ambrose Alli University',
    'Babcock University', 'Bayero University Kano', 'Benue State University', 'Bowen University',
    'Caritas University', 'Covenant University', 'Cross River University of Technology',
    'Delta State University', 'Ebonyi State University', 'Ekiti State University', 'Enugu State University of Science and Technology',
    'Federal University of Agriculture, Abeokuta', 'Federal University of Technology, Akure', 'Federal University of Technology, Minna',
    'Federal University of Technology, Owerri', 'Federal University, Oye-Ekiti', 'Godfrey Okoye University', 'Imo State University',
    'Kaduna State University', 'Kano University of Science and Technology', 'Lagos State University', 'Landmark University',
    'Niger Delta University', 'Nnamdi Azikiwe University', 'Obafemi Awolowo University', 'Olabisi Onabanjo University',
    'University of Abuja', 'University of Benin', 'University of Calabar', 'University of Ibadan', 'University of Ilorin',
    'University of Jos', 'University of Lagos', 'University of Maiduguri', 'University of Nigeria, Nsukka',
    'University of Port Harcourt', 'University of Uyo', 'Usmanu Danfodiyo University', 'Veritas University'
  ],
  department: [
    'Accounting', 'Agricultural Engineering', 'Agricultural Economics', 'Agriculture', 'Anatomy', 'Architecture',
    'Banking and Finance', 'Biochemistry', 'Biology', 'Building Technology', 'Business Administration',
    'Chemical Engineering', 'Chemistry', 'Civil Engineering', 'Computer Engineering', 'Computer Science', 'Criminology',
    'Dentistry', 'Economics', 'Education', 'Electrical Engineering', 'English Language', 'Environmental Science',
    'Estate Management', 'Finance', 'Food Science and Technology', 'Geography', 'Geology', 'History', 'Industrial Chemistry',
    'Information Technology', 'Insurance', 'Law', 'Library and Information Science', 'Linguistics', 'Marketing',
    'Mass Communication', 'Mathematics', 'Mechanical Engineering', 'Medicine and Surgery', 'Microbiology', 'Nursing',
    'Pharmacy', 'Philosophy', 'Physics', 'Political Science', 'Public Administration', 'Quantity Surveying',
    'Sociology', 'Statistics', 'Surveying and Geoinformatics', 'Theatre Arts'
  ],
}

function AlphabetPicker({ label, value, options, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const query = search.trim().toLocaleLowerCase()
  const visibleOptions = query
    ? options.filter((option) => option.toLocaleLowerCase().startsWith(query))
    : []

  return <div className="alphabet-picker">
    <label htmlFor={`${label}-search`}>{label}</label>
    <input
      id={`${label}-search`}
      type="text"
      value={search || value || ''}
      placeholder={`Search or enter ${label.toLowerCase()}`}
      autoComplete="off"
      aria-expanded={open}
      onFocus={() => { setSearch(value || ''); setOpen(true) }}
      onChange={(event) => { setSearch(event.target.value); onChange(event.target.value); setOpen(true) }}
      onBlur={() => window.setTimeout(() => setOpen(false), 150)}
    />
    {open && query && <div className="alphabet-picker-menu">
      <div className="alphabet-options" role="listbox" aria-label={`${label} matches`}>
        {visibleOptions.length ? visibleOptions.map((option) => <button type="button" role="option" aria-selected={value === option} key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setSearch(option); setOpen(false) }}>{option}</button>) : <span className="file-hint">No listed match. Keep typing your {label.toLowerCase()}.</span>}
      </div>
    </div>}
  </div>
}

export default function Profile({ role = 'student', profile, organizations = [], setProfile, onSave, onUploadAvatar, uploadingAvatar }) {
  const initials = profile.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const fields = role === 'admin'
    ? [['fullName', 'Full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['organization', 'Organization / SIWES placement']]
    : [['fullName', 'Full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['department', 'Department'], ['institution', 'Institution'], ['organization', 'Placement organization'], ['supervisor', 'Industry supervisor'], ['startDate', 'Start date'], ['endDate', 'End date']]
  return <div className="content narrow"><div className="profile-banner"><div className="profile-avatar-wrap">{profile.avatarUrl ? <img className="large-avatar profile-photo" src={profile.avatarUrl} alt={`${profile.fullName} profile`} /> : <div className="large-avatar">{initials}</div>}<label className="button button-light avatar-upload">{uploadingAvatar ? 'Uploading...' : 'Upload photo'}<input type="file" accept="image/*" disabled={uploadingAvatar} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadAvatar(file); event.target.value = '' }} /></label></div><div><span className="eyebrow">{role === 'admin' ? 'SUPERVISOR PROFILE' : 'YOUR SIWES PROFILE'}</span><h2>{profile.fullName}</h2><p>{role === 'admin' ? profile.organization || 'Set your organization to receive student registrations' : `${profile.department} · ${profile.organization}`}</p></div></div><form className="form-card" onSubmit={(event) => { event.preventDefault(); onSave() }}><div className="form-grid">{fields.map(([key, label]) => key === 'department' || key === 'institution' || key === 'organization' ? <div className="profile-picker-field" key={key}><AlphabetPicker label={label} value={profile[key]} options={key === 'organization' ? organizations : profileOptions[key]} onChange={(value) => setProfile({ ...profile, [key]: value })} /></div> : <label key={key}>{label}<input type={key.includes('Date') ? 'date' : key === 'email' ? 'email' : 'text'} value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}</div><div className="form-actions"><button className="button button-dark" type="submit">Save profile <span>→</span></button></div></form></div>
}
