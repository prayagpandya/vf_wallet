import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { colors } from '../../theme/colors';

interface ImageViewerModalProps {
  visible: boolean;
  imageUri?: string;
  title?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  title = 'Payment Screenshot',
  onClose,
}) => {
  const handleShare = async () => {
    if (!imageUri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && !imageUri.startsWith('http')) {
        await Sharing.shareAsync(imageUri);
      }
    } catch (e) {
      console.log('Error sharing image:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.titleText}>{title}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Image Content */}
        <View style={styles.imageWrapper}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={60} color="#666" />
              <Text style={styles.noImageText}>No screenshot uploaded</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#091E42',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeBtn: {
    padding: 6,
  },
  titleText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  shareBtn: {
    padding: 6,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
});

export default ImageViewerModal;
