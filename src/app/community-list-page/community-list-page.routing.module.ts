import { CdkTreeModule } from '@angular/cdk/tree';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { I18nBreadcrumbResolver } from '../core/breadcrumbs/i18n-breadcrumb.resolver';
import { CommunityListService } from './community-list-service';
import { ThemedCommunityListPageComponent } from './themed-community-list-page.component';

/**
 * RouterModule to help navigate to the page with the community list tree
 */
@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: ThemedCommunityListPageComponent,
        pathMatch: 'full',
        resolve: {
          breadcrumb: I18nBreadcrumbResolver,
        },
        data: { title: 'communityList.tabTitle', breadcrumbKey: 'communityList' },
      },
    ]),
    CdkTreeModule,
  ],
  providers: [CommunityListService],
})
export class CommunityListPageRoutingModule {
}
