import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Bell,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role?.toLowerCase();
  const canPost = role === 'admin' || role === 'hr';

  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    target_role: 'all',
  });

  // Fetch Announcements
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.getAnnouncements(),
  });

  // Post Mutation
  const postMutation = useMutation({
    mutationFn: (data: any) => api.createAnnouncement(data),
    onSuccess: () => {
      alert('Announcement posted successfully!');
      setShowPostModal(false);
      setPostForm({ title: '', content: '', priority: 'normal', target_role: 'all' });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to post announcement');
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return <Badge variant="danger">Urgent Notice</Badge>;
      case 'high':
        return <Badge variant="warning">High Priority</Badge>;
      case 'normal':
        return <Badge variant="primary">General Announcement</Badge>;
      case 'low':
        return <Badge variant="secondary">Notice</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-indigo-500" />
            Company Announcements & Notices
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Stay updated with company-wide policies, events, holiday announcements, and operational notices.
          </p>
        </div>

        {canPost && (
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowPostModal(true)}>
            Post Notice
          </Button>
        )}
      </div>

      {/* Announcements Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : announcements?.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Company notices and broadcast updates will appear here."
          />
        ) : (
          announcements.map((ann: any) => (
            <GlassCard
              key={ann.id}
              className={`p-6 transition-all border-l-4 ${
                ann.priority === 'urgent'
                  ? 'border-l-red-500 bg-red-500/5'
                  : ann.priority === 'high'
                  ? 'border-l-amber-500 bg-amber-500/5'
                  : 'border-l-indigo-500 bg-indigo-500/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{ann.title}</h3>
                  {getPriorityBadge(ann.priority)}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(ann.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {ann.target_role && ann.target_role !== 'all' && (
                    <Badge variant="secondary">Target: {ann.target_role.toUpperCase()}</Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {ann.content}
              </p>

              <div className="mt-4 pt-3 border-t border-gray-200/40 dark:border-gray-700/40 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  Posted by {ann.author_name || 'Management'}
                </span>
                <span className="text-[11px] text-gray-400">
                  {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Post Modal */}
      <Modal isOpen={showPostModal} onClose={() => setShowPostModal(false)} title="Broadcast Announcement">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            postMutation.mutate(postForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Eid-ul-Fitr Office Holidays Announcement"
              value={postForm.title}
              onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={postForm.priority}
                onChange={(e) => setPostForm({ ...postForm, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Target Audience
              </label>
              <select
                value={postForm.target_role}
                onChange={(e) => setPostForm({ ...postForm, target_role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="all">All Company</option>
                <option value="employee">Employees Only</option>
                <option value="hr">HR Team Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Message Content
            </label>
            <textarea
              required
              rows={5}
              placeholder="Type your notice or announcement here..."
              value={postForm.content}
              onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowPostModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={postMutation.isPending}>
              Post Notice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
