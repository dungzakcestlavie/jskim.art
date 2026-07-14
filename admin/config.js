// jskim.art Admin — public configuration only.
// Never place tokens, passwords, or credentials in this file.
// This file is committed to the public jskim.art repo.

window.JSKIM_CONFIG = {
  // GitHub repos (public reference only)
  repoArt: 'dungzakcestlavie/jskim.art',
  repoImages: 'dungzakcestlavie/jskim-images',

  // Raw image base URLs (must match local-helper output paths)
  imageBase: 'https://raw.githubusercontent.com/dungzakcestlavie/jskim-images/main',

  // Local helper endpoint (runs on 등작의 PC only, never deployed publicly)
  helperUrl: 'http://127.0.0.1:8420',

  // Status field options shown in the Admin form
  statusOptions: [
    { value: 'available',     kr: '판매 가능',     en: 'Available' },
    { value: 'reserved',      kr: '예약중',        en: 'Reserved' },
    { value: 'sold',          kr: '판매 완료',     en: 'Sold' },
    { value: 'not_for_sale',  kr: '비매품',        en: 'Not for Sale' }
  ],

  captionTypeOptions: [
    { value: 'none',     kr: '캡션 없음',        en: 'No caption' },
    { value: 'embedded', kr: '이미지에 포함',    en: 'Embedded in image' },
    { value: 'separate', kr: 'UI에 별도 표시',   en: 'Separate UI caption' }
  ]
};
