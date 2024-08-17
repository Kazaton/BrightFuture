'use client'

import { useState, useEffect } from 'react'
import { getAccessToken } from '@/lib/authUtils'
import API_ENDPOINTS from '@/lib/apiEndpoints'

interface User {
  username: string;
  email: string;
}

interface Profile {
  user: User;
  points: number;
  rank: number;
}

interface TopUser {
  user: User;
  points: number;
  rank: number;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const token = getAccessToken()
      if (!token) {
        window.location.href = '/login'
        return
      }

      try {
        const profileResponse = await fetch(API_ENDPOINTS.MY_PROFILE, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile')
        }
        const profileData = await profileResponse.json()
        setProfile(profileData)

        // Fetch top users
        const topResponse = await fetch(API_ENDPOINTS.TOP_USERS)
        if (topResponse.ok) {
          const topData = await topResponse.json()
          setTopUsers(topData)
        } else {
          console.error('Failed to fetch top users')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setError('Failed to load some profile data. Please try refreshing the page.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  if (!profile) {
    return <div>No profile data available. Please try logging in again.</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">User Profile</h1>
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <p className="text-gray-700 text-sm font-bold mb-2">Username: {profile.user.username}</p>
          <p className="text-gray-700 text-sm font-bold mb-2">Email: {profile.user.email}</p>
          <p className="text-gray-700 text-sm font-bold mb-2">Points: {profile.points}</p>
          <p className="text-gray-700 text-sm font-bold mb-2">Rank: {profile.rank}</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Top Users</h2>
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        {topUsers.length > 0 ? (
          topUsers.map((topUser, index) => (
            <div key={index} className="mb-2">
              <p className="text-gray-700 text-sm">
                {topUser.rank}. {topUser.user.username} - Points: {topUser.points}
              </p>
            </div>
          ))
        ) : (
          <p>No top users data available.</p>
        )}
      </div>
    </div>
  )
}