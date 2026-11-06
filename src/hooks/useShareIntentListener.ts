import { useEffect, useState } from 'react';
import { useShareIntent } from 'expo-share-intent';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface SharedImagePayload {
  uri: string;
  mimeType?: string;
  fileName?: string;
}

export function useShareIntentListener() {
  const [sharedImage, setSharedImage] = useState<SharedImagePayload | null>(null);

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    disabled: isExpoGo,
  });

  useEffect(() => {
    if (!isExpoGo && hasShareIntent && shareIntent) {
      if (shareIntent.files && shareIntent.files.length > 0) {
        const file = shareIntent.files[0];
        if (file.path) {
          setSharedImage({
            uri: file.path,
            mimeType: file.mimeType,
            fileName: file.fileName,
          });
          resetShareIntent();
        }
      }
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  const clearSharedImage = () => {
    setSharedImage(null);
  };

  return {
    sharedImage,
    clearSharedImage,
  };
}

