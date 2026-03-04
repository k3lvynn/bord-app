// hooks/useInstagramShare.ts
// Platform-agnostic event image sharing.
// After capturing the card, opens the native iOS/Android share sheet so the user
// can pick ANY app they have: Instagram, Snapchat, Facebook, Threads, Twitter/X,
// Reddit, Messages, WhatsApp, Discord, etc.
import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { ShareCanvasHandle, ShareFormat } from '../components/ShareCanvas';

interface UseEventShareReturn {
  canvasRef: React.RefObject<ShareCanvasHandle>;
  pickerVisible: boolean;
  selectedFormat: ShareFormat | null;
  isCapturing: boolean;
  openPicker: () => void;
  closePicker: () => void;
  onFormatSelected: (format: ShareFormat) => Promise<void>;
}

export function useInstagramShare(): UseEventShareReturn {
  const canvasRef = useRef<ShareCanvasHandle>(null);
  const [pickerVisible,  setPickerVisible]  = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ShareFormat | null>(null);
  const [isCapturing,    setIsCapturing]    = useState(false);

  const openPicker  = useCallback(() => setPickerVisible(true), []);
  const closePicker = useCallback(() => {
    if (!isCapturing) setPickerVisible(false);
  }, [isCapturing]);

  const onFormatSelected = useCallback(async (format: ShareFormat) => {
    setSelectedFormat(format);
    setIsCapturing(true);
    try {
      // Give React a tick to repaint at the new canvas dimensions
      await new Promise<void>(r => setTimeout(r, 120));
      if (!canvasRef.current) throw new Error('Canvas not ready');
      const tempUri = await canvasRef.current.capture();
      const destUri = `${FileSystem.cacheDirectory}bord_share_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      setIsCapturing(false);
      setPickerVisible(false);
      // Native share sheet: user picks their own preferred app
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'Sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(destUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share this event',
        UTI: 'public.jpeg',
      });
    } catch (err) {
      setIsCapturing(false);
      console.error('[useEventShare]', err);
      Alert.alert('Share failed', 'Something went wrong preparing the image. Please try again.');
    }
  }, []);

  return { canvasRef, pickerVisible, selectedFormat, isCapturing, openPicker, closePicker, onFormatSelected };
}
