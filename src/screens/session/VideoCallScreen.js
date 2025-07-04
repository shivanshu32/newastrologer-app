import React from 'react';
import { useRoute } from '@react-navigation/native';
import VideoConsultationScreen from '../VideoConsultationScreen';

const VideoCallScreen = () => {
  const route = useRoute();
  
  return <VideoConsultationScreen {...route.params} />;
};

export default VideoCallScreen;
