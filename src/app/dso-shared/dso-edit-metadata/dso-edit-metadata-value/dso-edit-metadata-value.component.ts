import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { DsoEditMetadataChangeType, DsoEditMetadataValue } from '../dso-edit-metadata-form';
import { Observable } from 'rxjs/internal/Observable';
import {
  MetadataRepresentation,
  MetadataRepresentationType
} from '../../../core/shared/metadata-representation/metadata-representation.model';
import { RelationshipDataService } from '../../../core/data/relationship-data.service';
import { DSpaceObject } from '../../../core/shared/dspace-object.model';
import { ItemMetadataRepresentation } from '../../../core/shared/metadata-representation/item/item-metadata-representation.model';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { getItemPageRoute } from '../../../item-page/item-page-routing-paths';
import { DSONameService } from '../../../core/breadcrumbs/dso-name.service';
import { EMPTY } from 'rxjs/internal/observable/empty';
import { ConfigurationDataService } from 'src/app/core/data/configuration-data.service';
import { BehaviorSubject, of } from 'rxjs';
import { hasValue } from 'src/app/shared/empty.util';
import { VocabularyService } from 'src/app/core/submission/vocabularies/vocabulary.service';
import { VocabularyOptions } from 'src/app/core/submission/vocabularies/models/vocabulary-options.model';
import { PageInfo } from 'src/app/core/shared/page-info.model';
import { VocabularyEntry } from 'src/app/core/submission/vocabularies/models/vocabulary-entry.model';
import { ConfidenceType } from 'src/app/core/shared/confidence-type';


@Component({
  selector: 'ds-dso-edit-metadata-value',
  styleUrls: ['./dso-edit-metadata-value.component.scss', '../dso-edit-metadata-shared/dso-edit-metadata-cells.scss'],
  templateUrl: './dso-edit-metadata-value.component.html',
})
/**
 * Component displaying a single editable row for a metadata value
 */
export class DsoEditMetadataValueComponent implements OnInit, OnChanges {
  /**
   * The parent {@link DSpaceObject} to display a metadata form for
   * Also used to determine metadata-representations in case of virtual metadata
   */
  @Input() dso: DSpaceObject;

  /**
   * Editable metadata value to show
   */
  @Input() mdValue: DsoEditMetadataValue;

  /**
   * Type of DSO we're displaying values for
   * Determines i18n messages
   */
  @Input() dsoType: string;

  /**
   * Name of the existing metadata field,
   * if the value of an existing field is being edited
   */
  @Input() mdField?: string;

  /**
   * Name of the new metadata field,
   * if a new metadatafield is being added
   */
  @Input() newMdField?: string;


  /**
   * Observable to check if the form is being saved or not
   * Will disable certain functionality while saving
   */
  @Input() saving$: Observable<boolean>;

  /**
   * Is this value the only one within its list?
   * Will disable certain functionality like dragging (because dragging within a list of 1 is pointless)
   */
  @Input() isOnlyValue = false;

  /**
   * Emits when the user clicked edit
   */
  @Output() edit: EventEmitter<any> = new EventEmitter<any>();

  /**
   * Emits when the user clicked confirm
   */
  @Output() confirm: EventEmitter<boolean> = new EventEmitter<boolean>();

  /**
   * Emits when the user clicked remove
   */
  @Output() remove: EventEmitter<any> = new EventEmitter<any>();

  /**
   * Emits when the user clicked undo
   */
  @Output() undo: EventEmitter<any> = new EventEmitter<any>();

  /**
   * Emits true when the user starts dragging a value, false when the user stops dragging
   */
  @Output() dragging: EventEmitter<boolean> = new EventEmitter<boolean>();

  /**
   * The DsoEditMetadataChangeType enumeration for access in the component's template
   * @type {DsoEditMetadataChangeType}
   */
  public DsoEditMetadataChangeTypeEnum = DsoEditMetadataChangeType;

  /**
   * The item this metadata value represents in case it's virtual (if any, otherwise null)
   */
  mdRepresentation$: Observable<ItemMetadataRepresentation | null>;

  /**
   * The route to the item represented by this virtual metadata value (otherwise null)
   */
  mdRepresentationItemRoute$: Observable<string | null>;

  /**
   * The name of the item represented by this virtual metadata value (otherwise null)
   */
  mdRepresentationName$: Observable<string | null>;

  authoritySubscribed = false;

  /**
   * Name of the controlled vocabulary choice plugin for the current metadata field
   */

  controlledVocabulary: BehaviorSubject<string | null> = new BehaviorSubject(null);

  /*
   * If requests loading authority suggestions are in flight
   */
  loadingAuthoritySuggestions: BehaviorSubject<boolean> = new BehaviorSubject(false);

  /**
   * If the currently edited metadatafield is under authority control
   */
  isAuthorityField: BehaviorSubject<boolean> = new BehaviorSubject(false);

  /**
   * Name of the metadata field being edited
   */
  protected currentMdField: BehaviorSubject<string | null> = new BehaviorSubject(null);

  /**
   * List of choice plugin suggestions
   */
  authoritySuggestions: BehaviorSubject<VocabularyEntry[]> = new BehaviorSubject([]);


  constructor(protected relationshipService: RelationshipDataService,
              protected dsoNameService: DSONameService,
              protected configService: ConfigurationDataService,
              protected vocabService: VocabularyService) {
  }


  ngOnInit(): void {
    this.initVirtualProperties();
  }

  valueChanged() {
    if (hasValue(this.controlledVocabulary.value) &&
        hasValue(this.mdValue?.newValue?.value)) {

      this.loadingAuthoritySuggestions.next(true);
      this.vocabService.getVocabularyEntriesByValue(
        this.mdValue.newValue.value,
        false,
        new VocabularyOptions(this.controlledVocabulary.value),
        new PageInfo()
      ).pipe(
        filter(x => x.hasCompleted),
        tap(() => this.loadingAuthoritySuggestions.next(false)),
        filter(x => x.hasSucceeded && hasValue(x.payload)),
        map(x => x.payload.page),
        filter(x => !( // If there is exactly one hit with the same value and authority as the current MD value
          x.length === 1 && // It's because the user *just* selected it. Let the autocomplete box disappear then
          x[0].value === this.mdValue?.newValue?.value &&
          x[0].authority === this.mdValue?.newValue?.authority)),
      ).subscribe(x => this.authoritySuggestions.next(x));
    }
    // Not using controlled vocabulary, but still an authority field (e.g. dc.identifier.ldap)
    // Set the value as authority value as well
    if (!hasValue(this.controlledVocabulary.value) &&
        hasValue(this.mdValue?.newValue?.value) &&
        this.isAuthorityField.value) {
      this.mdValue.newValue.authority = this.mdValue.newValue.value;
      this.mdValue.newValue.confidence = ConfidenceType.CF_ACCEPTED;
    }
    this.confirm.emit(false);
  }

  select(entry: VocabularyEntry) {
    this.mdValue.newValue.value = entry.value;
    this.mdValue.newValue.authority = entry.authority;
    this.mdValue.newValue.confidence = ConfidenceType.CF_ACCEPTED;
    this.authoritySuggestions.next([]);
  }

  // Check if the current field is using a choices plugin or is authority controlled
  subscribeToAuthority() {
    this.authoritySubscribed = true;
    this.currentMdField.pipe(
      switchMap(x => hasValue(x) ? this.configService.findByPropertyName(`choices.plugin.${x}`) : of(null)),
      filter(x => x !== null && x.hasSucceeded && hasValue(x.payload)),
      map(x => x.payload.values),
      filter(x => x.length > 0),
      map(x => x[0]),
    ).subscribe(prop => this.controlledVocabulary.next(prop));
    this.currentMdField.pipe(
      switchMap(x => hasValue(x) ? this.configService.findByPropertyName(`authority.controlled.${x}`) : of(null)),
      filter(x => x !== null && x.hasSucceeded && hasValue(x.payload)),
      map(x => x.payload.values),
      filter(x => x.length > 0),
      map(x => x[0]),
    ).subscribe(prop => this.isAuthorityField.next(prop === 'true'));
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes.mdField) {
      this.currentMdField.next(changes.mdField.currentValue);
    } else if (changes.newMdField) {
      if (!this.authoritySubscribed) {
        this.subscribeToAuthority();
      }
      this.currentMdField.next(changes.newMdField.currentValue);
    }
  }


  /**
   * Initialise potential properties of a virtual metadata value
   */
  initVirtualProperties(): void {
    this.mdRepresentation$ = this.mdValue.newValue.isVirtual ?
      this.relationshipService.resolveMetadataRepresentation(this.mdValue.newValue, this.dso, 'Item')
        .pipe(
          map((mdRepresentation: MetadataRepresentation) =>
            mdRepresentation.representationType === MetadataRepresentationType.Item ? mdRepresentation as ItemMetadataRepresentation : null
          )
        ) : EMPTY;
    this.mdRepresentationItemRoute$ = this.mdRepresentation$.pipe(
      map((mdRepresentation: ItemMetadataRepresentation) => mdRepresentation ? getItemPageRoute(mdRepresentation) : null),
    );
    this.mdRepresentationName$ = this.mdRepresentation$.pipe(
      map((mdRepresentation: ItemMetadataRepresentation) => mdRepresentation ? this.dsoNameService.getName(mdRepresentation) : null),
    );
  }
}
