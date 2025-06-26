import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  Video,
  MapPin,
  Filter,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CreateMeetingModal from './CreateMeetingModal';

interface Meeting {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetLink: string;
  location?: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdBy: string;
}

const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Mock meetings data
  const meetings: Meeting[] = [
    {
      id: '1',
      title: 'Daily Standup',
      description: 'Daily team sync and progress updates',
      startTime: new Date(2024, 2, 15, 9, 0),
      endTime: new Date(2024, 2, 15, 9, 30),
      attendees: ['1', '2', '3', '4'],
      meetLink: 'https://meet.google.com/abc-defg-hij',
      status: 'scheduled',
      createdBy: '1',
    },
    {
      id: '2',
      title: 'Project Review',
      description: 'Weekly project review and planning session',
      startTime: new Date(2024, 2, 15, 14, 0),
      endTime: new Date(2024, 2, 15, 15, 30),
      attendees: ['1', '2', '3'],
      meetLink: 'https://meet.google.com/xyz-uvwx-yz',
      status: 'scheduled',
      createdBy: '1',
    },
    {
      id: '3',
      title: 'Client Presentation',
      description: 'Present project progress to client',
      startTime: new Date(2024, 2, 16, 10, 0),
      endTime: new Date(2024, 2, 16, 11, 0),
      attendees: ['1', '2'],
      meetLink: 'https://meet.google.com/client-meet-123',
      location: 'Conference Room A',
      status: 'scheduled',
      createdBy: '1',
    },
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.startTime);
      return (
        meetingDate.getDate() === date.getDate() &&
        meetingDate.getMonth() === date.getMonth() &&
        meetingDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-600';
      case 'ongoing':
        return 'bg-green-600';
      case 'completed':
        return 'bg-gray-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar & Meetings</h1>
          <p className="text-gray-400">Schedule and manage your meetings</p>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowCreateMeeting(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        )}
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-white min-w-[200px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-800 rounded-lg p-1">
            {['month', 'week', 'day'].map((viewType) => (
              <button
                key={viewType}
                onClick={() => setView(viewType as any)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                  view === viewType
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {viewType}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {dayNames.map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={index} className="p-2 h-24"></div>;
                }

                const dayMeetings = getMeetingsForDate(day);
                const isToday = 
                  day.getDate() === new Date().getDate() &&
                  day.getMonth() === new Date().getMonth() &&
                  day.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={index}
                    className={`p-2 h-24 border border-gray-700 rounded-lg hover:bg-gray-700/30 transition-colors ${
                      isToday ? 'bg-purple-600/20 border-purple-500' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-purple-400' : 'text-white'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayMeetings.slice(0, 2).map((meeting) => (
                        <div
                          key={meeting.id}
                          onClick={() => setSelectedMeeting(meeting)}
                          className={`text-xs p-1 rounded cursor-pointer ${getStatusColor(meeting.status)} text-white truncate`}
                        >
                          {formatTime(meeting.startTime)} {meeting.title}
                        </div>
                      ))}
                      {dayMeetings.length > 2 && (
                        <div className="text-xs text-gray-400">
                          +{dayMeetings.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Meetings Sidebar */}
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search meetings..."
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full"
            />
          </div>

          {/* Upcoming Meetings */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-4">Upcoming Meetings</h3>
            <div className="space-y-3">
              {meetings
                .filter(meeting => meeting.startTime > new Date())
                .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                .slice(0, 5)
                .map((meeting) => (
                  <div
                    key={meeting.id}
                    onClick={() => setSelectedMeeting(meeting)}
                    className="p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white text-sm">{meeting.title}</h4>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(meeting.status)}`}></span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <Users className="w-3 h-3" />
                        <span>{meeting.attendees.length} attendees</span>
                      </div>
                      {meeting.meetLink && (
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <Video className="w-3 h-3" />
                          <span>Video call</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                <Video className="w-4 h-4" />
                <span>Start Instant Meeting</span>
              </button>
              <button className="w-full flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                <Calendar className="w-4 h-4" />
                <span>View All Meetings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{selectedMeeting.title}</h3>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-300">{selectedMeeting.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {selectedMeeting.startTime.toLocaleDateString()} • {formatTime(selectedMeeting.startTime)} - {formatTime(selectedMeeting.endTime)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{selectedMeeting.attendees.length} attendees</span>
                  </div>
                  
                  {selectedMeeting.location && (
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedMeeting.location}</span>
                    </div>
                  )}
                </div>
                
                {selectedMeeting.meetLink && (
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors">
                    <Video className="w-4 h-4" />
                    <span>Join Meeting</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateMeeting && (
        <CreateMeetingModal onClose={() => setShowCreateMeeting(false)} />
      )}
    </div>
  );
};

export default CalendarView;