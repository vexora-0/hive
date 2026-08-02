import { useMutation } from '@tanstack/react-query';

import { useToast } from '@/components/feedback';
import { apiErrorMessage } from '@/utils/errorMessage';
import { useAuthStore } from '../stores/authStore';
import { updateMe, type UpdateProfilePayload } from '../services/profileService';

/**
 * `useUpdateProfile` -- saves the signed-in user's name and phone.
 *
 * Writes the server's response straight back into `authStore` rather than
 * refetching: every screen reads the display name from that store, so without
 * this the header would keep showing the old name until the next sign-in.
 */
export function useUpdateProfile() {
  const setProfile = useAuthStore((s) => s.setProfile);
  const toast = useToast();

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateMe(data),

    onSuccess: (profile) => {
      setProfile(profile);
      toast.success('Profile updated');
    },

    onError: (error: unknown) =>
      toast.error(
        apiErrorMessage(error, 'Could not save your profile. Please try again.'),
      ),
  });
}
