import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
const KEY='glovebox.ai.thirdPartyConsent.v1';
export async function ensureAiConsent():Promise<boolean>{if((await AsyncStorage.getItem(KEY))==='1')return true;return new Promise(resolve=>Alert.alert('AI privacy notice','When you use Glovebox AI, the repair details you enter — and receipt images you choose to scan — are sent to our AI provider to generate the result. Do not scan a receipt if it contains information you do not want processed by AI.',[{text:'Not now',style:'cancel',onPress:()=>resolve(false)},{text:'Continue',onPress:()=>{void AsyncStorage.setItem(KEY,'1').then(()=>resolve(true));}}],{cancelable:false}));}
