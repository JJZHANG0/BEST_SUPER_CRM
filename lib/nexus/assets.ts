/** Static deployments may be mounted under a repository path. Blob URLs bypass this helper. */
export const assetUrl=(path:string)=>(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/'+path.replace(/^\//,'');
