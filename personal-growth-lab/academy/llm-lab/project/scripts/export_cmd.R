#!/usr/bin/env Rscript
# CurateMicrobiota: explicit, auditable curatedMetagenomicData export.
# This script is an optional real-data adapter. The offline teaching pipeline
# does not need R, Bioconductor, a network connection, or real cohort downloads.
# Official API checked: 2026-10-21.
# https://waldronlab.io/curatedMetagenomicData/reference/returnSamples.html

args <- commandArgs(trailingOnly = TRUE)
script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
if (length(script_arg) != 1L) stop("Run this adapter with Rscript scripts/export_cmd.R.")
script_path <- normalizePath(sub("^--file=", "", script_arg), mustWork = TRUE)
source(file.path(dirname(script_path), "cmd_contract.R"))
usage <- paste(
  "Usage:",
  "  Rscript scripts/export_cmd.R list data/cmd_catalog",
  "  Rscript scripts/export_cmd.R export configs/cmd_selection.json data/real",
  "Before first use, install curatedMetagenomicData, SummarizedExperiment, jsonlite.",
  sep = "\n"
)
if (length(args) < 1L || !args[[1L]] %in% c("list", "export")) stop(usage)
required <- c("curatedMetagenomicData", "SummarizedExperiment", "jsonlite")
missing_packages <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_packages)) {
  stop(paste0("Missing R packages: ", paste(missing_packages, collapse = ", "),
              ". See README real-data installation. No data were downloaded."))
}

md <- as.data.frame(curatedMetagenomicData::sampleMetadata,
                    stringsAsFactors = FALSE, check.names = FALSE)
for (name in c("sample_id", "study_name", "study_condition", "body_site")) {
  if (!name %in% names(md)) stop(paste("Installed metadata lacks required field:", name))
}
write_json <- function(object, file) jsonlite::write_json(
  object, file, pretty = TRUE, auto_unbox = TRUE, na = "null", null = "null"
)
command <- args[[1L]]

if (command == "list") {
  if (length(args) != 2L) stop(usage)
  out <- args[[2L]]
  dir.create(out, recursive = TRUE, showWarnings = FALSE)
  counts <- as.data.frame(table(
    study = md$study_name,
    condition = ifelse(is.na(md$study_condition), "<MISSING>", md$study_condition),
    body_site = ifelse(is.na(md$body_site), "<MISSING>", md$body_site)
  ), stringsAsFactors = FALSE)
  counts <- counts[counts$Freq > 0L, , drop = FALSE]
  names(counts)[names(counts) == "Freq"] <- "samples"
  utils::write.csv(counts, file.path(out, "catalog_studies.csv"), row.names = FALSE, na = "")
  writeLines(names(md), file.path(out, "metadata_fields.txt"))
  capture.output(utils::sessionInfo(), file = file.path(out, "sessionInfo.txt"))
  message("Wrote metadata-only catalog to ", out,
          ". Review study/condition fields before choosing cohorts and label_map.")
  quit(status = 0L)
}

if (length(args) != 3L) stop(usage)
cfg <- jsonlite::read_json(args[[2L]], simplifyVector = TRUE)
out <- args[[3L]]
split_names <- c("train", "val", "test")
splits <- lapply(split_names, function(s) as.character(cfg[[paste0(s, "_studies")]]))
names(splits) <- split_names
if (any(lengths(splits) == 0L)) stop("train_studies, val_studies and test_studies must all be explicit nonempty arrays.")
studies <- unlist(splits, use.names = FALSE)
if (anyDuplicated(studies)) stop("A study occurs in more than one split (or is duplicated within a split).")
if (any(grepl("REPLACE", studies))) stop("Replace the study placeholders after inspecting the metadata catalog.")
absent <- setdiff(studies, unique(as.character(md$study_name)))
if (length(absent)) stop(paste("Study names not present in this installed metadata version:", paste(absent, collapse = ", ")))
if (is.null(cfg$label_map) || length(cfg$label_map) < 2L) stop("label_map must explicitly map reviewed study_condition strings to 0 or 1.")
label_map <- unlist(cfg$label_map, use.names = TRUE)
if (any(!label_map %in% c(0L, 1L)) || !all(c(0L, 1L) %in% label_map)) stop("label_map must contain both binary classes 0 and 1.")
if (is.null(names(label_map)) || any(!nzchar(names(label_map)))) stop("label_map needs exact condition names from catalog_studies.csv.")
if (is.null(cfg$abundance_unit) || !cfg$abundance_unit %in% c("proportion", "percent")) stop("Set abundance_unit explicitly to proportion or percent; units are not guessed.")
site <- if (is.null(cfg$body_site)) "stool" else as.character(cfg$body_site)
sel <- md[md$study_name %in% studies & !is.na(md$body_site) & md$body_site == site, , drop = FALSE]
known <- !is.na(sel$study_condition) & sel$study_condition %in% names(label_map)
unknown <- is.na(sel$study_condition) | !nzchar(trimws(as.character(sel$study_condition)))
keep_unlabelled <- isTRUE(cfg$include_unlabelled_train)
sel <- sel[known | (keep_unlabelled & unknown & sel$study_name %in% splits$train), , drop = FALSE]
if (!nrow(sel)) stop("No samples match the requested studies, body site and exact label mapping.")
if (anyDuplicated(paste(sel$study_name, sel$sample_id, sep = "::"))) stop("Duplicate study/sample keys in selected metadata. Resolve duplicates before export.")
# The official returnSamples interface selects by sample_id. If these collide
# across selected studies, do not silently relabel before calling the package.
if (anyDuplicated(sel$sample_id)) stop("sample_id is duplicated across selected studies. Export these studies separately and reconcile their provenance explicitly.")
for (s in split_names) {
  sm <- sel[sel$study_name %in% splits[[s]], , drop = FALSE]
  mapped <- unname(label_map[as.character(sm$study_condition)])
  if (!all(c(0L, 1L) %in% mapped)) stop(paste("Both mapped classes are required in", s, "for this binary teaching evaluation."))
  if (!all(splits[[s]] %in% sm$study_name)) stop(paste("One or more", s, "studies have no selected samples."))
}
if (!"subject_id" %in% names(sel)) sel$subject_id <- NA_character_
missing_subject <- is.na(sel$subject_id) | !nzchar(trimws(as.character(sel$subject_id)))
if (any(missing_subject) && !isTRUE(cfg$allow_unresolved_subject_ids)) {
  stop(paste(sum(missing_subject), "samples lack subject_id. Resolve IDs, exclude the affected cohorts, or explicitly acknowledge this limitation with allow_unresolved_subject_ids=true."))
}
dir.create(out, recursive = TRUE, showWarnings = FALSE)
if (any(file.exists(file.path(out, c("abundance.csv", "metadata.csv", "split.json"))))) {
  stop("Output data files already exist. Use a new versioned directory to preserve the previous data and split.")
}
utils::write.csv(sel, file.path(out, "selected_metadata_before_download.csv"), row.names = FALSE, na = "")
write_json(cfg, file.path(out, "export_config.json"))
message("Fetching relative_abundance resources. Even a sample subset may require entire-study downloads.")
se <- curatedMetagenomicData::returnSamples(
  sel, dataType = "relative_abundance", counts = FALSE, rownames = "long"
)
ab <- as.matrix(SummarizedExperiment::assay(se))
cd <- as.data.frame(SummarizedExperiment::colData(se), stringsAsFactors = FALSE, check.names = FALSE)
aligned <- reconcile_cmd_samples(colnames(ab), cd, sel)
cd <- aligned$returned
original <- aligned$original
keys <- aligned$keys
if (anyDuplicated(rownames(ab))) stop("Duplicated taxonomy row names; resolve the feature mapping before export.")
species <- grepl("(^|\\|)s__", rownames(ab)) & !grepl("(^|\\|)t__", rownames(ab))
if (sum(species) < 4L) stop("Fewer than four species rows found. Inspect taxonomy format; this adapter does not infer a different rank.")
ab <- t(ab[species, , drop = FALSE])
if (any(!is.finite(ab)) || any(ab < 0)) stop("Abundance has missing, nonfinite or negative values.")
input_species_row_sums <- summary(rowSums(ab))
if (cfg$abundance_unit == "percent") ab <- ab / 100
if (any(ab > 1 + 1e-6) || any(rowSums(ab) > 1.01)) {
  stop("Species abundances exceed proportion units (or duplicated ranks remain). Inspect units/taxonomy; no automatic renormalization was performed.")
}
if (any(rowSums(ab) <= 0)) stop("Some selected samples have no positive species abundance.")
sid <- as.character(original$subject_id)
missing_now <- is.na(sid) | !nzchar(trimws(sid))
sid[missing_now] <- paste0("UNRESOLVED_SAMPLE_", original$sample_id[missing_now])
subject_keys <- paste(original$study_name, sid, sep = "::")
labels <- unname(label_map[as.character(original$study_condition)])
metadata <- data.frame(sample_id = keys, study = as.character(original$study_name),
                       subject_id = subject_keys, label = labels,
                       subject_id_unresolved = missing_now, stringsAsFactors = FALSE)
if (any(!is.na(metadata$label) & !metadata$label %in% c(0L, 1L))) stop("Unexpected mapped label.")
utils::write.csv(data.frame(sample_id = keys, ab, check.names = FALSE),
                 file.path(out, "abundance.csv"), row.names = FALSE, na = "")
utils::write.csv(metadata, file.path(out, "metadata.csv"), row.names = FALSE, na = "")
utils::write.csv(original, file.path(out, "metadata_original.csv"), row.names = FALSE, na = "")
# Keep arrays, including a split with one study.
jsonlite::write_json(lapply(splits, as.list), file.path(out, "split.json"), pretty = TRUE, auto_unbox = TRUE)
provenance <- list(
  source_kind = "curatedMetagenomicData_user_selected_real_data",
  source = "https://waldronlab.io/curatedMetagenomicData/",
  exported_utc = format(Sys.time(), tz = "UTC", usetz = TRUE),
  package_version = as.character(utils::packageVersion("curatedMetagenomicData")),
  data_type = "relative_abundance", counts = FALSE,
  input_unit = cfg$abundance_unit, output_unit = "proportion",
  input_species_row_sum_summary = as.list(input_species_row_sums),
  output_species_row_sum_summary = as.list(summary(rowSums(ab))),
  sample_alignment = "Assay column IDs matched to colData row names; exact requested/returned study-sample key set required.",
  preprocessing = "Species rank only; optional fixed division by 100. No prevalence filter, train/test fitting, CLR or row renormalization.",
  samples = nrow(ab), taxa = ncol(ab), studies = as.list(studies),
  subject_id_unresolved_count = sum(missing_now),
  subject_namespace = "study_name::subject_id; cross-study duplicate donors/cohorts still require provenance review",
  licensing = "Package software license does not establish uniform underlying cohort data rights. Consult original study and resource terms.",
  adapter_status = "Official API matched; real-data execution depends on installed package/resources and the reviewed selection config."
)
write_json(provenance, file.path(out, "data_provenance.json"))
capture.output(str(S4Vectors::metadata(se)), file = file.path(out, "resource_metadata.txt"))
capture.output(utils::sessionInfo(), file = file.path(out, "sessionInfo.txt"))
files <- file.path(out, c("abundance.csv", "metadata.csv", "split.json", "metadata_original.csv"))
utils::write.csv(data.frame(file = basename(files), md5 = unname(tools::md5sum(files))),
                 file.path(out, "export_checksums_md5.csv"), row.names = FALSE)
message("Export complete: ", nrow(ab), " samples, ", ncol(ab), " species. Run inspect-data before training.")
