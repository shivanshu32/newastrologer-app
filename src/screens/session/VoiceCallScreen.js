import React from 'react';
import { useRoute } from '@react-navigation/native';
import VoiceCallScreen from '../VoiceCallScreen';

const VoiceCallWrapper = () => {
  const route = useRoute();
  
  return <VoiceCallScreen {...route.params} />;
};

export default VoiceCallWrapper;
