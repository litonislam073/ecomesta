import { contentRoute } from '@/lib/marketing/content-route';

const route = contentRoute('payments');

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
