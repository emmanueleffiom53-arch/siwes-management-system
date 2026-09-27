import { useEffect, useState } from 'react'
import './styles/app.css'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Activities from './pages/Activities.jsx'
import AddActivity from './pages/AddActivity.jsx'
import Profile from './pages/Profile.jsx'
import Progress from './pages/Progress.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import ReviewActivity from './pages/ReviewActivity.jsx'
import { Icon } from './components/UI.jsx'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'

const titles = { dashboard: 'Overview', activities: 'My activities', profile: 'My profile', progress: 'Progress report', admin: 'Review centre' }
const uploadBucket = 'siwes-uploads'
const maxImageSize = 5 * 1024 * 1024

function validateImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP, or GIF image.')
  if (file.size > maxImageSize) throw new Error('Images must be 5 MB or smaller.')
}

async function signedImageUrl(path) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(uploadBucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

function mapProfile(row) {
  return {
    fullName: row.full_name,
    email: row.email || '',
    phone: row.phone || '',
    department: row.department || '',
    institution: row.institution || '',
    organization: row.organization || '',
    organizationId: row.organization_id || null,
    supervisor: row.supervisor || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    avatarPath: row.profile_image_path || '',
    avatarUrl: '',
  }
}

function mapActivity(row, studentName = '') {
  return {
    id: row.id,
    date: row.activity_date,
    title: row.activity,
    description: row.description,
    status: row.status,
    userId: row.user_id,
    studentName,
    studentEmail: row.student_email || '',
    imagePath: row.image_path || '',
    imageUrl: '',
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [role, setRole] = useState('student')
  const [activities, setActivities] = useState([])
  const [studentCount, setStudentCount] = useState(0)
  const [studentRoster, setStudentRoster] = useState([])
  const [organizationOptions, setOrganizationOptions] = useState([])
  const [workspaceReload, setWorkspaceReload] = useState(0)
  const [profile, setProfile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingActivityImage, setUploadingActivityImage] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const approved = activities.filter((item) => item.status === 'Approved').length
  const pending = activities.filter((item) => item.status === 'Pending').length
  const progress = activities.length ? Math.round((approved / activities.length) * 100) : 0
  const navigate = (nextScreen) => { setNotice(''); setScreen(nextScreen) }
  const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoadError(error.message)
      setSession(data?.session || null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_IN') {
        setProfile(null)
        setLoadError('')
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setActivities([])
        setStudentCount(0)
        setStudentRoster([])
        setOrganizationOptions([])
        setRole('student')
        setScreen('home')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady) return undefined
    if (!session) return undefined

    let cancelled = false
    const loadWorkspace = async () => {
      const { data: profileRow, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profileError) throw profileError
      const nextRole = profileRow.role === 'admin' ? 'admin' : 'student'
      const [{ data: activityRows, error: activityError }, { data: organizations, error: organizationsError }] = await Promise.all([
        supabase.from('activities').select('*').order('activity_date', { ascending: false }),
        supabase.from('organizations').select('id, name').order('name'),
      ])
      if (activityError) throw activityError
      if (organizationsError) throw organizationsError
      let studentProfiles = []
      if (nextRole === 'admin') {
        if (profileRow.organization_id) {
          const { data: profiles, error } = await supabase.from('profiles')
            .select('id, full_name, email, role, department, institution, organization, organization_id, profile_image_path')
            .eq('role', 'student')
            .eq('organization_id', profileRow.organization_id)
          if (error) throw error
          studentProfiles = profiles
        }
        setStudentCount(studentProfiles.length)
      } else {
        setStudentCount(0)
        studentProfiles = [profileRow]
      }
      if (cancelled) return
      const loadedProfile = mapProfile(profileRow)
      loadedProfile.avatarUrl = await signedImageUrl(loadedProfile.avatarPath)
      const profileById = new Map(studentProfiles.map((item) => [item.id, item]))
      const { data: reviewRows, error: reviewsError } = nextRole === 'admin'
        ? await supabase.from('activity_reviews').select('*').order('reviewed_at', { ascending: false })
        : { data: [], error: null }
      if (reviewsError) throw reviewsError
      const reviewsByActivity = new Map()
      for (const review of reviewRows) {
        const current = reviewsByActivity.get(review.activity_id) || []
        current.push(review)
        reviewsByActivity.set(review.activity_id, current)
      }
      const loadedActivities = await Promise.all(activityRows.map(async (row) => {
        const student = profileById.get(row.user_id)
        const item = mapActivity({ ...row, student_email: student?.email }, student?.full_name || 'Student')
        item.imageUrl = await signedImageUrl(item.imagePath)
        item.studentAvatarUrl = await signedImageUrl(student?.profile_image_path)
        item.reviews = reviewsByActivity.get(row.id) || []
        return item
      }))
      if (cancelled) return
      setProfile(loadedProfile)
      setRole(nextRole)
      setOrganizationOptions(organizations.map((organization) => organization.name))
      setStudentRoster(await Promise.all(studentProfiles.filter((student) => student.role === 'student').map(async (student) => ({
        id: student.id,
        fullName: student.full_name,
        email: student.email || '',
        department: student.department || '',
        institution: student.institution || '',
        avatarUrl: await signedImageUrl(student.profile_image_path),
      }))))
      setActivities(loadedActivities)
      setScreen(nextRole === 'admin' ? 'admin' : 'dashboard')
    }
    loadWorkspace().catch((error) => {
      if (!cancelled) {
        setLoadError(error.message || 'Could not load your workspace.')
      }
    })
    return () => { cancelled = true }
  }, [authReady, session, workspaceReload])

  useEffect(() => {
    if (!session || role !== 'admin' || screen !== 'admin') return undefined
    const channel = supabase.channel(`supervisor-roster-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        setWorkspaceReload((current) => current + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session, role, screen])

  const submitLogin = async ({ email, password }) => {
    if (!isSupabaseConfigured) throw new Error('Add your Supabase URL and publishable key to .env.local first.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const submitRegistration = async ({ fullName, email, password }) => {
    if (!isSupabaseConfigured) throw new Error('Add your Supabase URL and publishable key to .env.local first.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    if (!data.session) return { message: 'Check your email for a confirmation link, then sign in.' }
    return undefined
  }

  const saveActivity = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const old = activities.find((activity) => activity.id === editingId)
    const values = {
      user_id: session.user.id,
      activity_date: form.get('date'),
      activity: form.get('title'),
      description: form.get('description'),
    }
    const imageFile = form.get('image')
    let imagePath = old?.imagePath || ''
    if (imageFile?.size) {
      try {
        validateImage(imageFile)
        setUploadingActivityImage(true)
        imagePath = `${session.user.id}/activities/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from(uploadBucket).upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false })
        if (uploadError) throw uploadError
      } catch (error) {
        setNotice(error.message || 'Could not upload the activity image.')
        setUploadingActivityImage(false)
        return
      }
    }
    values.image_path = imagePath || null
    const request = editingId
      ? supabase.from('activities').update(values).eq('id', editingId).select().single()
      : supabase.from('activities').insert(values).select().single()
    const { data, error } = await request
    if (error) {
      if (imagePath && imagePath !== old?.imagePath) await supabase.storage.from(uploadBucket).remove([imagePath])
      setNotice(error.message)
      setUploadingActivityImage(false)
      return
    }
    const item = mapActivity(data, profile.fullName)
    item.imageUrl = await signedImageUrl(item.imagePath)
    if (old) item.status = old.status
    setActivities((current) => editingId ? current.map((activity) => activity.id === editingId ? item : activity) : [item, ...current])
    setEditingId(null)
    setNotice('Activity saved successfully.')
    formElement.reset()
    setScreen('activities')
    setUploadingActivityImage(false)
    if (old?.imagePath && old.imagePath !== imagePath) await supabase.storage.from(uploadBucket).remove([old.imagePath])
  }

  const deleteActivity = async (id) => {
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (error) { setNotice(error.message); return }
    setActivities((current) => current.filter((activity) => activity.id !== id))
    setNotice('Activity deleted.')
  }

  const uploadAvatar = async (file) => {
    try {
      validateImage(file)
      setUploadingAvatar(true)
      const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
      const path = `${session.user.id}/profile/avatar.${extension}`
      const { error: uploadError } = await supabase.storage.from(uploadBucket).upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError
      const { error: profileError } = await supabase.from('profiles').update({ profile_image_path: path }).eq('id', session.user.id)
      if (profileError) throw profileError
      setProfile((current) => ({ ...current, avatarPath: path, avatarUrl: '' }))
      const avatarUrl = await signedImageUrl(path)
      setProfile((current) => ({ ...current, avatarPath: path, avatarUrl }))
      setNotice('Profile photo updated.')
    } catch (error) {
      setNotice(error.message || 'Could not upload the profile photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const submitReview = async (id, status, comment) => {
    setReviewing(true)
    const { error: statusError } = await supabase.from('activities').update({ status }).eq('id', id)
    if (statusError) {
      setNotice(statusError.message)
      setReviewing(false)
      return
    }
    const { error: reviewError } = await supabase.from('activity_reviews').insert({
      activity_id: id,
      reviewer_id: session.user.id,
      comment: comment.trim() || null,
      status,
    })
    setActivities((current) => current.map((activity) => activity.id === id ? { ...activity, status } : activity))
    setNotice(reviewError ? `Activity ${status.toLowerCase()}, but review note failed: ${reviewError.message}` : `Activity ${status.toLowerCase()}.`)
    setReviewing(false)
    setScreen('admin')
  }

  const saveProfile = async () => {
    const { data, error } = await supabase.from('profiles').update({
      full_name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      department: profile.department,
      institution: profile.institution,
      organization: profile.organization,
      supervisor: profile.supervisor,
      start_date: profile.startDate || null,
      end_date: profile.endDate || null,
    }).eq('id', session.user.id).select('*').single()
    if (error) {
      setNotice(error.message)
      return
    }
    const updatedProfile = mapProfile(data)
    updatedProfile.avatarUrl = profile.avatarUrl
    setProfile(updatedProfile)
    const { data: organizations, error: organizationsError } = await supabase.from('organizations').select('id, name').order('name')
    if (!organizationsError) setOrganizationOptions(organizations.map((organization) => organization.name))
    setNotice('Profile updated successfully. Organization assignment is saved.')
    if (role === 'admin') {
      setScreen('admin')
      setWorkspaceReload((current) => current + 1)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setNotice(error.message)
    else navigate('home')
  }

  if (!authReady || (session && !profile && !loadError)) return <div className="auth-page"><p className="muted">Loading your workspace...</p></div>
  if (session && loadError) return <div className="auth-page"><div className="auth-card"><h1>Workspace unavailable</h1><p className="muted">{loadError}. Confirm the Supabase schema and live-auth migration have been applied.</p><button className="button button-dark" onClick={signOut}>Sign out</button></div></div>
  if (screen === 'home') return <Home onStart={() => navigate('register')} onLogin={() => navigate('login')} />
  if (screen === 'login') return <Login onBack={() => navigate('home')} onSubmit={submitLogin} />
  if (screen === 'register') return <Register onBack={() => navigate('home')} onSubmit={submitRegistration} />

  const navigation = role === 'admin' ? ['admin', 'profile'] : ['dashboard', 'activities', 'profile', 'progress']
  const initials = profile.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const reviewItem = activities.find((item) => item.id === Number(editingId))
  if (screen === 'review' && reviewItem) return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>SIWES<br /><b>TRACKER</b></span></div><div className="side-label">Workspace</div><nav><button className="nav-item active" onClick={() => navigate('admin')}><Icon>◫</Icon>{titles.admin}</button></nav><div className="sidebar-bottom"><button className="logout" onClick={signOut}>↪ <span>Sign out</span></button></div></aside><main className="main-content"><header className="topbar"><div><span className="eyebrow">SUPERVISOR PORTAL</span><h1>Activity review</h1></div><div className="user-chip">{profile.avatarUrl ? <img className="header-avatar" src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}<div><strong>{profile.fullName}</strong><small>Supervisor</small></div></div></header>{notice && <div className="notice">{notice}</div>}<ReviewActivity activity={reviewItem} onBack={() => navigate('admin')} onReview={submitReview} saving={reviewing} /></main></div>
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>SIWES<br /><b>TRACKER</b></span></div><div className="side-label">Workspace</div><nav>{navigation.map((item) => <button className={screen === item ? 'nav-item active' : 'nav-item'} key={item} onClick={() => navigate(item)}><Icon>{item === 'dashboard' ? '⌂' : item === 'activities' ? '▤' : item === 'profile' ? '◎' : item === 'progress' ? '◔' : '◫'}</Icon>{titles[item]}</button>)}</nav><div className="sidebar-bottom"><div className="security"><Icon>✓</Icon><div><strong>Private workspace</strong><small>Your records are protected</small></div></div><button className="logout" onClick={signOut}>↪ <span>Sign out</span></button></div></aside><main className="main-content"><header className="topbar"><div><span className="eyebrow">{role === 'admin' ? 'SUPERVISOR PORTAL' : 'STUDENT PORTAL'}</span><h1>{titles[screen] || 'Overview'}</h1></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<i /></button><div className="user-chip">{profile.avatarUrl ? <img className="header-avatar" src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}<div><strong>{profile.fullName}</strong><small>{role === 'admin' ? 'Supervisor' : profile.department || 'Student'}</small></div></div></div></header>{notice && <div className="notice">{notice}</div>}{screen === 'dashboard' && <Dashboard profile={profile} activities={activities} approved={approved} pending={pending} progress={progress} navigate={navigate} />}{screen === 'activities' && <Activities activities={activities} navigate={navigate} formatDate={formatDate} onEdit={(item) => { setEditingId(item.id); navigate('add') }} onDelete={deleteActivity} />}{screen === 'add' && <AddActivity onSave={saveActivity} editing={activities.find((item) => item.id === editingId)} onCancel={() => navigate('activities')} uploadingImage={uploadingActivityImage} />}{screen === 'profile' && <Profile role={role} profile={profile} organizations={organizationOptions} setProfile={setProfile} onSave={saveProfile} onUploadAvatar={uploadAvatar} uploadingAvatar={uploadingAvatar} />}{screen === 'progress' && <Progress profile={profile} activities={activities} approved={approved} pending={pending} total={activities.length} progress={progress} />}{screen === 'admin' && <AdminDashboard activities={activities} students={studentRoster} organization={profile.organization} studentCount={studentCount} onOpenActivity={(item) => { setEditingId(item.id); navigate('review') }} formatDate={formatDate} />}</main></div>
}
