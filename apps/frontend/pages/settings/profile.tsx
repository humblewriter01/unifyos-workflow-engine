// apps/frontend/pages/settings/profile.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { User, Mail, Camera, Save, Loader2, CheckCircle } from 'lucide-react';

export default function ProfileSettings() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
    } else {
      setFormData({
        name: session.user?.name || '',
        email: session.user?.email || '',
        bio: '',
      });
    }
  }, [session, router]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      await update({ name: formData.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Profile Settings</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your profile information and preferences
          </p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Profile updated successfully!
            </p>
          </div>
        )}

        {/* Profile Photo */}
        <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Profile Photo
          </h2>
          <div className="flex items-center space-x-6">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
                Upload a new photo
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                JPG, PNG or GIF. Max size 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-neutral-900 dark:text-white"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Email cannot be changed for security reasons
              </p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-neutral-900 dark:text-white"
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Plan Badge */}
          <div className="pt-4 border-t border-neutral-200 dark:border-dark-700">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Current Plan
            </label>
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                {session.user?.plan || 'FREE'} Plan
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-dark-700">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
