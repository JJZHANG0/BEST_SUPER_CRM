/** Static deployments may be mounted under a repository path. Blob URLs bypass this helper. */
export const assetUrl=(path:string)=>(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/'+path.replace(/^\//,'');
/** Bump when the favicon / app icons change so browsers refetch them (also in public/manifest.webmanifest). */
export const ICON_VERSION='20261012';
export const iconUrl=(path:string)=>assetUrl(path)+'?v='+ICON_VERSION;
