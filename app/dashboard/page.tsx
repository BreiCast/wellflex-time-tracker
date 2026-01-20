'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ClockInOut from '@/components/ClockInOut'
import ActiveSession from '@/components/ActiveSession'
import TimesheetView from '@/components/TimesheetView'
import RequestsView from '@/components/RequestsView'
import CreateTeamForm from '@/components/CreateTeamForm'
import DashboardNav from '@/components/DashboardNav'
import TeamSelector from '@/components/TeamSelector'
import TeamManagement from '@/components/TeamManagement'

export const dynamic = 'force-dynamic'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [activeBreak, setActiveBreak] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('tracking')
  const [userRole, setUserRole] = useState<string>('MEMBER')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Read tab and team from URL query params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'tracking'
    const teamParam = searchParams.get('team')
    
    if (tab === 'tracking') {
      router.push('/tracking')
      return
    }
    setActiveTab(tab)
    
    // Set selected team from URL parameter if provided
    if (teamParam) {
      setSelectedTeam(teamParam)
    }
  }, [searchParams, router])

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return []

    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (!response.ok) {
        console.error('Error loading teams:', result.error)
        return []
      }

      const teamList = (result.teams || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        role: team.role,
      }))

      if (teamList.length > 0) {
        const hasManagementRole = teamList.some((tm: any) =>
          ['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(tm.role)
        )
        const superAdminFlag = Boolean(result.is_superadmin)
        setIsSuperAdmin(superAdminFlag)
        setUserRole(superAdminFlag ? 'SUPERADMIN' : (hasManagementRole ? 'ADMIN' : 'MEMBER'))

        setTeams(teamList)
        
        // Check URL parameter first, then selectedTeam, then default to first team
        const teamParam = searchParams.get('team')
        let resolvedTeamId = ''
        if (teamParam && teamList.some(t => t.id === teamParam)) {
          // URL parameter takes precedence
          setSelectedTeam(teamParam)
          resolvedTeamId = teamParam
        } else if (teamList.length > 0 && !selectedTeam) {
          // Only set default team if no team is selected and no valid URL param
          setSelectedTeam(teamList[0].id)
          resolvedTeamId = teamList[0].id
        } else {
          resolvedTeamId = selectedTeam
        }

        if (!superAdminFlag && resolvedTeamId) {
          const selected = teamList.find((team: any) => team.id === resolvedTeamId)
          if (selected?.role) {
            setUserRole(selected.role)
          }
        }
        
        return teamList
      }
    } catch (error) {
      console.error('Error in loadTeams:', error)
    }
    return []
  }, [selectedTeam, searchParams])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Check for team parameter in URL and set it before loading teams
      const teamParam = searchParams.get('team')
      if (teamParam) {
        setSelectedTeam(teamParam)
      }

      // Load user's teams
      await loadTeams()

      // Load active session
      const { data: sessionData } = await supabase
        .from('time_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionData) {
        setActiveSession(sessionData)

        // Load active break
        const { data: breakData } = await supabase
          .from('break_segments')
          .select('*')
          .eq('time_session_id', (sessionData as any).id)
          .is('break_end_at', null)
          .maybeSingle()

        setActiveBreak(breakData || null)
      }

      setLoading(false)
    }

    loadData()
  }, [router, loadTeams])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const refreshData = async () => {
    await loadTeams()
    // Reload active session
    if (user) {
      const supabase = createClient()
      const { data: sessionData } = await supabase
        .from('time_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionData) {
        setActiveSession(sessionData)
        const { data: breakData } = await supabase
          .from('break_segments')
          .select('*')
          .eq('time_session_id', (sessionData as any).id)
          .is('break_end_at', null)
          .maybeSingle()
        setActiveBreak(breakData || null)
      } else {
        setActiveSession(null)
        setActiveBreak(null)
      }
    }
  }

  const renderTabContent = () => {
    if (teams.length === 0) {
      return (
        <div className="bg-white shadow rounded-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Create Your First Team</h2>
          <p className="text-gray-600 mb-6">
            You need to be part of a team to start tracking time. Create a team to get started.
          </p>
          <CreateTeamForm onTeamCreated={async () => {
            const newTeams = await loadTeams()
            if (newTeams && newTeams.length > 0 && newTeams[0]) {
              setSelectedTeam(newTeams[0].id)
            } else {
              setTimeout(() => {
                window.location.reload()
              }, 1000)
            }
          }} />
        </div>
      )
    }

    switch (activeTab) {
      case 'tracking':
        return (
          <div className="max-w-4xl mx-auto">
            <TeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
            />
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Time Tracking</h2>
              {activeSession ? (
                <ActiveSession
                  session={activeSession}
                  breakSegment={activeBreak}
                  onSessionUpdate={refreshData}
                />
              ) : (
                <ClockInOut
                  teamId={selectedTeam}
                  onSessionStart={refreshData}
                />
              )}
            </div>
          </div>
        )

      case 'timesheet':
        return (
          <div className="max-w-7xl mx-auto">
            <TeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
            />
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] p-8 border border-slate-100">
              <TimesheetView teamId={selectedTeam} />
            </div>
          </div>
        )

      case 'requests':
        return (
          <div className="max-w-7xl mx-auto">
            <TeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
            />
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">My Requests</h2>
              <RequestsView userId={user?.id} teamId={selectedTeam} />
            </div>
          </div>
        )

      case 'teams':
        return (
          <div className="max-w-7xl mx-auto">
            {selectedTeam && (
              <div className="bg-white shadow rounded-lg p-6">
                <TeamSelector
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamChange={async (teamId) => {
                    setSelectedTeam(teamId)
                    if (isSuperAdmin) {
                      setUserRole('SUPERADMIN')
                      return
                    }
                    const selected = teams.find((team: any) => team.id === teamId)
                    if (selected?.role) {
                      setUserRole(selected.role)
                    }
                  }}
                />
                <TeamManagement teamId={selectedTeam} userRole={userRole} />
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'tracking') {
            router.push('/tracking')
          } else {
            setActiveTab(tab)
          }
        }}
        userEmail={user?.email}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderTabContent()}
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
