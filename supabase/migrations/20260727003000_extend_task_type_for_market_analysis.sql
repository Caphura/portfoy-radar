alter type public.task_type
  add value if not exists 'analysis_collect_comparables';

alter type public.task_type
  add value if not exists 'analysis_prepare_price_summary';

alter type public.task_type
  add value if not exists 'analysis_advisor_review';

comment on type public.task_type is
  'Görüşme, randevu ve pazar analizi için kaynak bağlı planlı işlerin güvenli tür kümesi.';
