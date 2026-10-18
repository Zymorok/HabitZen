import { useTranslation } from 'react-i18next';
import { SoonScreen } from '../../../shared/ui/SoonScreen';

import lake from '../../../../assets/onboarding/lake.webp';

// TODO(HZ-05): Таймер 25/5 с паузой, сбросом, перерывом и звуками (кадры 06–07).
export function FocusSoonScreen() {
  const { t } = useTranslation('focus');
  return (
    <SoonScreen testID="focus-soon" title={t('soon_title')} body={t('soon_body')} image={lake} />
  );
}
