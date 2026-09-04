import { Redirect, useLocalSearchParams } from 'expo-router';

export default function BillingReturnScreen() {
  const params = useLocalSearchParams<{
    order?: string;
    payment?: string;
  }>();
  console.info('PAYU_MOBILE_RETURN_RECEIVED', params.order ?? 'missing-order');

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/profile',
        params: {
          ...(params.order ? { order: params.order } : {}),
          ...(params.payment ? { payment: params.payment } : {}),
        },
      }}
    />
  );
}