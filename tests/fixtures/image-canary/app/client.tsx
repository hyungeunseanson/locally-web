'use client';
import {useState, useSyncExternalStore} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useExperienceFilter} from '@/app/hooks/useExperienceFilter';
import PublicExperienceDetailImage from '@/app/components/PublicExperienceDetailImage';
import PublicExperienceCardImage from '@/app/components/PublicExperienceCardImage';
import type {PublicHomeExperience} from '@/app/home/homeExperienceTypes';
const subscribe = () => () => {};
function Cards({initialExperiences,updatedAt}:{initialExperiences:PublicHomeExperience[];updatedAt:number}) {
  const {filteredExperiences} = useExperienceFilter({initialExperiences,initialExperiencesUpdatedAt:updatedAt});
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return <main data-hydrated={hydrated}>{filteredExperiences.map(row=><div key={row.id}><a href={`/experiences/${row.id}`} key={row.id} style={{display:'block',position:'relative',width:320,height:320}}>
    <PublicExperienceCardImage experienceId={row.id} originImageUrl={row.card_image_url!} r2Eligible={row.public_image_r2_eligible} alt="SSR canary" sizes="320px" className="image" eager />
  </a><div style={{position:"relative",width:320,height:320}}><PublicExperienceDetailImage experienceId={row.id} originImageUrl={row.card_image_url!} r2Eligible={row.public_image_r2_eligible} alt="SSR detail" sizes="320px" className="image" eager /></div></div>)}</main>;
}
export default function Client(props:{initialExperiences:PublicHomeExperience[];updatedAt:number}) {
  const [client]=useState(()=>new QueryClient());
  return <QueryClientProvider client={client}><Cards {...props}/></QueryClientProvider>;
}
