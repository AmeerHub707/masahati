import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// إصلاح مسارات أيقونة Leaflet الافتراضية — نفس الإصلاح المطبَّق في SpacesPage.
// بدون هذه الأسطر تُطلب الأيقونة من أصل المضيف (مسار الحزمة) فتفشل.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/* Leaflet لا يلاحظ تغيّر أبعاد حاويته (طيّ العمود، تغيير حجم النافذة) فيرسم
   البلاطات بمقاسات قديمة. هنا الحاوية ثابتة النسبة، لكن تغيير حجم النافذة
   يقع فعلاً أثناء عرض الصفحة، فنراقبه بنفس منطق SpacesPage. */
function MapSizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    map.invalidateSize();

    let lastW = 0;
    let lastH = 0;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      // invalidateSize يغيّر المقاس بدوره، فالمقارنة تمنع استدعاءً لا نهائياً
      if (box.width === lastW && box.height === lastH) return;
      lastW = box.width;
      lastH = box.height;
      map.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  return null;
}

/**
 * خريطة موقع المساحة — علامة واحدة فقط، بلا نافذة منبثقة وبلا تكبير بعجلة
 * الفأرة حتى لا تختطف تمرير الصفحة أثناء مرور المؤشر فوق الخريطة.
 *
 * لا تُصيَّر إطلاقاً إن غابت الإحداثيات: القرار في AdDetailsPage، لا هنا.
 *
 * @param {{lat:number, lng:number, title?:string}} props
 */
export default function SpaceLocationMap({ lat, lng, title = '' }) {
  const point = useMemo(() => [lat, lng], [lat, lng]);

  return (
    <MapContainer
      center={point}
      zoom={15}
      scrollWheelZoom={false}
      dragging={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={point} title={title} />
      <MapSizeWatcher />
    </MapContainer>
  );
}
