import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  NgbModal,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  Subscription,
} from 'rxjs';
import {
  filter,
  map,
  take,
} from 'rxjs/operators';

import {
  APP_CONFIG,
  AppConfig,
} from '../../../../../../config/app-config.interface';
import { FilterVocabularyConfig } from '../../../../../../config/filter-vocabulary-config';
import { RemoteDataBuildService } from '../../../../../core/cache/builders/remote-data-build.service';
import { PageInfo } from '../../../../../core/shared/page-info.model';
import { SearchService } from '../../../../../core/shared/search/search.service';
import { SearchConfigurationService } from '../../../../../core/shared/search/search-configuration.service';
import {
  FILTER_CONFIG,
  IN_PLACE_SEARCH,
  REFRESH_FILTER,
  SCOPE,
  SearchFilterService,
} from '../../../../../core/shared/search/search-filter.service';
import { VocabularyEntryDetail } from '../../../../../core/submission/vocabularies/models/vocabulary-entry-detail.model';
import { VocabularyService } from '../../../../../core/submission/vocabularies/vocabulary.service';
import { SEARCH_CONFIG_SERVICE } from '../../../../../my-dspace-page/my-dspace-page.component';
import { hasValue } from '../../../../empty.util';
import { VocabularyTreeviewModalComponent } from '../../../../form/vocabulary-treeview-modal/vocabulary-treeview-modal.component';
import { FacetValue } from '../../../models/facet-value.model';
import { FilterType } from '../../../models/filter-type.model';
import { SearchFilterConfig } from '../../../models/search-filter-config.model';
import {
  addOperatorToFilterValue,
  getFacetValueForType,
} from '../../../search.utils';
import {
  facetLoad,
  SearchFacetFilterComponent,
} from '../search-facet-filter/search-facet-filter.component';
import { renderFacetFor } from '../search-filter-type-decorator';

@Component({
  selector: 'ds-search-hierarchy-filter',
  styleUrls: ['./search-hierarchy-filter.component.scss'],
  templateUrl: './search-hierarchy-filter.component.html',
  animations: [facetLoad],
})

/**
 * Component that represents a hierarchy facet for a specific filter configuration
 */
@renderFacetFor(FilterType.hierarchy)
export class SearchHierarchyFilterComponent extends SearchFacetFilterComponent implements OnDestroy, OnInit {

  subscriptions: Subscription[] = [];

  constructor(protected searchService: SearchService,
              protected filterService: SearchFilterService,
              protected rdbs: RemoteDataBuildService,
              protected router: Router,
              protected modalService: NgbModal,
              protected vocabularyService: VocabularyService,
              @Inject(APP_CONFIG) protected appConfig: AppConfig,
              @Inject(SEARCH_CONFIG_SERVICE) public searchConfigService: SearchConfigurationService,
              @Inject(IN_PLACE_SEARCH) public inPlaceSearch: boolean,
              @Inject(FILTER_CONFIG) public filterConfig: SearchFilterConfig,
              @Inject(REFRESH_FILTER) public refreshFilters: BehaviorSubject<boolean>,
              @Inject(SCOPE) public scope: string,
  ) {
    super(searchService, filterService, rdbs, router, searchConfigService, inPlaceSearch, filterConfig, refreshFilters, scope);
  }

  vocabularyExists$: Observable<boolean>;

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.subscriptions.forEach((subscription: Subscription) => subscription.unsubscribe());
  }

  /**
   * Submits a new active custom value to the filter from the input field
   * Overwritten method from parent component, adds the "query" operator to the received data before passing it on
   * @param data The string from the input field
   */
  onSubmit(data: any) {
    super.onSubmit(addOperatorToFilterValue(data, 'query'));
  }

  ngOnInit(): void {
    super.ngOnInit();
    const vocabularyName: string = this.getVocabularyEntry();
    if (hasValue(vocabularyName)) {
      this.vocabularyExists$ = this.vocabularyService.searchTopEntries(
        vocabularyName, new PageInfo(), true, false,
      ).pipe(
        filter(rd => rd.hasCompleted),
        take(1),
        map(rd => {
          return rd.hasSucceeded;
        }),
      );
    }
  }

  /**
   * Open the vocabulary tree modal popup.
   * When an entry is selected, add the filter query to the search options.
   */
  showVocabularyTree() {
    const modalRef: NgbModalRef = this.modalService.open(VocabularyTreeviewModalComponent, {
      size: 'lg',
      windowClass: 'treeview',
    });
    modalRef.componentInstance.vocabularyOptions = {
      name: this.getVocabularyEntry(),
      closed: true,
    };
    this.subscriptions.push(combineLatest([
      (modalRef.componentInstance as VocabularyTreeviewModalComponent).select,
      this.selectedValues$.pipe(take(1)),
    ]).subscribe(([detail, selectedValues]: [VocabularyEntryDetail, FacetValue[]]) => {
      void this.router.navigate(
        [this.searchService.getSearchLink()],
        {
          queryParams: {
            [this.filterConfig.paramName]: [...selectedValues, { value: detail.value }]
              .map((facetValue: FacetValue) => getFacetValueForType(facetValue, this.filterConfig)),
          },
          queryParamsHandling: 'merge',
        },
      );
    }));
  }

  /**
   * Returns the matching vocabulary entry for the given search filter.
   * These are configurable in the config file.
   */
  getVocabularyEntry(): string {
    const foundVocabularyConfig: FilterVocabularyConfig[] = this.appConfig.vocabularies.filter((v: FilterVocabularyConfig) => v.filter === this.filterConfig.name);
    if (foundVocabularyConfig.length > 0 && foundVocabularyConfig[0].enabled === true) {
      return foundVocabularyConfig[0].vocabulary;
    }
  }
}
