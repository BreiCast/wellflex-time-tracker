'use client'

import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
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

  // Read tab from URL query params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'tracking'
    if (tab === 'tracking') {
      router.push('/tracking')
      return
    }
    setActiveTab(tab)
  }, [searchParams, router])

  const loadTeams = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return []

    try {
      // Load user's teams directly from team_members
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name)')
        .eq('user_id', session.user.id)

      if (teamError) {
        console.error('Error loading teams:', teamError)
        return []
      }

      if (teamMembers && teamMembers.length > 0) {
        const teamList = teamMembers
          .filter((tm: any) => tm.teams) // Filter out any null teams
          .map((tm: any) => ({
            id: tm.team_id,
            name: tm.teams.name,
          }))
        setTeams(teamList)
        if (teamList.length > 0 && !selectedTeam) {
          setSelectedTeam(teamList[0].id)
        }
        
        // Load user role for selected team
        if (selectedTeam || (teamList.length > 0 && teamList[0].id)) {
          const teamId = selectedTeam || teamList[0].id
          const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', session.user.id)
            .single()
          if (memberData && 'role' in memberData) {
            setUserRole((memberData as any).role)
          }
        }
        
        return teamList
      }
    } catch (error) {
      console.error('Error in loadTeams:', error)
    }
    return []
  }

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

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
  }, [router])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
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
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Timesheet</h2>
              <TimesheetView userId={user?.id} teamId={selectedTeam} />
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800">
                💡 Teams management has moved to a dedicated page. 
                <button
                  onClick={() => router.push('/teams')}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Go to Teams Management →
                </button>
              </p>
            </div>
            {selectedTeam && (
              <div className="bg-white shadow rounded-lg p-6">
                <TeamSelector
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamChange={async (teamId) => {
                    setSelectedTeam(teamId)
                    // Load user role for new team
                    const supabase = createClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    if (session) {
                      const { data: memberData } = await supabase
                        .from('team_members')
                        .select('role')
                        .eq('team_id', teamId)
                        .eq('user_id', session.user.id)
                        .single()
                      if (memberData && 'role' in memberData) {
                        setUserRole((memberData as any).role)
                      }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'tracking') {
            router.push('/tracking')
          } else {
            setActiveTab(tab)
            router.push(`/dashboard?tab=${tab}`)
          }
        }}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderTabContent()}
      </main>
    </div>
  )
}
