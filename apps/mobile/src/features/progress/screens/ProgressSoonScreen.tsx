import { useTranslation } from 'react-i18next';
import { SoonScreen } from '../../../shared/ui/SoonScreen';

import tree from '../../../../assets/onboarding/tree.webp';

// TODO(HZ-05): Календарь, история и статистика привычек (кадры 08–09).
export function ProgressSoonScreen() {
  const { t } = useTranslation('progress');
  return (
    <SoonScreen testID="progress-soon" title={t('soon_title')} body={t('soon_body')} image={tree} />
  );
}
