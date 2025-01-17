import { CommonModule } from '@angular/common';
import {
  DebugElement,
  EventEmitter,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  NgbModal,
  NgbModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import {
  BehaviorSubject,
  of as observableOf,
} from 'rxjs';

import { APP_CONFIG } from '../../../../../../config/app-config.interface';
import { environment } from '../../../../../../environments/environment.test';
import { RemoteDataBuildService } from '../../../../../core/cache/builders/remote-data-build.service';
import { buildPaginatedList } from '../../../../../core/data/paginated-list.model';
import { RemoteData } from '../../../../../core/data/remote-data';
import { RequestEntryState } from '../../../../../core/data/request-entry-state.model';
import { PageInfo } from '../../../../../core/shared/page-info.model';
import { SearchService } from '../../../../../core/shared/search/search.service';
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
import { RouterStub } from '../../../../testing/router.stub';
import { SearchConfigurationServiceStub } from '../../../../testing/search-configuration-service.stub';
import { FacetValue } from '../../../models/facet-value.model';
import { SearchFilterConfig } from '../../../models/search-filter-config.model';
import { SearchHierarchyFilterComponent } from './search-hierarchy-filter.component';

describe('SearchHierarchyFilterComponent', () => {

  let fixture: ComponentFixture<SearchHierarchyFilterComponent>;
  let showVocabularyTreeLink: DebugElement;

  const testSearchLink = 'test-search';
  const testSearchFilter = 'subject';
  const VocabularyTreeViewComponent = {
    select: new EventEmitter<VocabularyEntryDetail>(),
  };

  const searchService = {
    getSearchLink: () => testSearchLink,
    getFacetValuesFor: () => observableOf([]),
  };
  const searchFilterService = {
    getPage: () => observableOf(0),
  };
  const router = new RouterStub();
  const ngbModal = jasmine.createSpyObj('modal', {
    open: {
      componentInstance: VocabularyTreeViewComponent,
    },
  });
  const vocabularyService = {
    searchTopEntries: () => undefined,
  };

  beforeEach(() => {
    return TestBed.configureTestingModule({
      imports: [
        CommonModule,
        NgbModule,
        TranslateModule.forRoot(),
      ],
      declarations: [
        SearchHierarchyFilterComponent,
      ],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: SearchFilterService, useValue: searchFilterService },
        { provide: RemoteDataBuildService, useValue: {} },
        { provide: Router, useValue: router },
        { provide: NgbModal, useValue: ngbModal },
        { provide: VocabularyService, useValue: vocabularyService },
        { provide: APP_CONFIG, useValue: environment },
        { provide: SEARCH_CONFIG_SERVICE, useValue: new SearchConfigurationServiceStub() },
        { provide: IN_PLACE_SEARCH, useValue: false },
        { provide: FILTER_CONFIG, useValue: Object.assign(new SearchFilterConfig(), { name: testSearchFilter }) },
        { provide: REFRESH_FILTER, useValue: new BehaviorSubject<boolean>(false) },
        { provide: SCOPE, useValue: undefined },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function init() {
    fixture = TestBed.createComponent(SearchHierarchyFilterComponent);
    fixture.detectChanges();
    showVocabularyTreeLink = fixture.debugElement.query(By.css(`a#show-${testSearchFilter}-tree`));
  }

  describe('if the vocabulary doesn\'t exist', () => {

    beforeEach(() => {
      spyOn(vocabularyService, 'searchTopEntries').and.returnValue(observableOf(new RemoteData(
        undefined, 0, 0, RequestEntryState.Error, undefined, undefined, 404,
      )));
      init();
    });

    it('should not show the vocabulary tree link', () => {
      expect(showVocabularyTreeLink).toBeNull();
    });
  });

  describe('if the vocabulary exists', () => {

    beforeEach(() => {
      spyOn(vocabularyService, 'searchTopEntries').and.returnValue(observableOf(new RemoteData(
        undefined, 0, 0, RequestEntryState.Success, undefined, buildPaginatedList(new PageInfo(), []), 200,
      )));
      init();
    });

    it('should show the vocabulary tree link', () => {
      expect(showVocabularyTreeLink).toBeTruthy();
    });

    describe('when clicking the vocabulary tree link', () => {

      const alreadySelectedValues = [
        'already-selected-value-1',
        'already-selected-value-2',
      ];
      const newSelectedValue = 'new-selected-value';

      beforeEach(async () => {
        fixture.componentInstance.selectedValues$ = observableOf(
          alreadySelectedValues.map(value => Object.assign(new FacetValue(), { value })),
        );
        showVocabularyTreeLink.nativeElement.click();
        VocabularyTreeViewComponent.select.emit(Object.assign(new VocabularyEntryDetail(), {
          value: newSelectedValue,
        }));
      });

      it('should open the vocabulary tree modal', () => {
        expect(ngbModal.open).toHaveBeenCalled();
      });

      describe('when selecting a value from the vocabulary tree', () => {

        it('should add a new search filter to the existing search filters', fakeAsync(() => {
          tick();
          expect(router.navigate).toHaveBeenCalledWith([testSearchLink], {
            queryParams: {
              [`f.${testSearchFilter}`]: [
                ...alreadySelectedValues,
                newSelectedValue,
              ].map((value => `${value},equals`)),
            },
            queryParamsHandling: 'merge',
          });
        }));
      });
    });
  });
});
