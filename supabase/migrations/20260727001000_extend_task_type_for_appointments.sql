alter type public.task_type
  add value if not exists 'appointment_preparation';

comment on type public.task_type is
  'Görüşme takibi ve randevu hazırlığı gibi planlı işlerin güvenli tür kümesi.';
